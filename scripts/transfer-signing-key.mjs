// Private keys/passwords stay in files; only receiver public keys reach stdout.
import {
  createCipheriv,
  createDecipheriv,
  createPrivateKey,
  createPublicKey,
  diffieHellman,
  generateKeyPairSync,
  hkdfSync,
  randomBytes,
  X509Certificate,
} from 'node:crypto'
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  rmdirSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { unzipSync } from 'fflate'

const PREFIX = 'JIDO-RECEIVER-'
const FORMAT = 'JDo-signing-transfer-v1'
const INFO = Buffer.from(FORMAT)
const root = resolve(import.meta.dirname, '..')
const [command, ...args] = process.argv.slice(2)
function option(name, fallback) {
  const index = args.indexOf(name)
  if (index < 0) return fallback
  if (!args[index + 1] || args[index + 1].startsWith('--'))
    throw new Error(`Missing value for ${name}`)
  return args[index + 1]
}
function privateFile(path, data) {
  writeFileSync(path, data, { mode: 0o600, flag: 'wx' })
}
function encodedPublic(key) {
  return createPublicKey(key)
    .export({ type: 'spki', format: 'der' })
    .toString('base64url')
}
function publicKey(encoded) {
  if (!/^[A-Za-z0-9_-]{50,100}$/.test(encoded))
    throw new Error('Invalid receiver public key')
  const key = createPublicKey({
    key: Buffer.from(encoded, 'base64url'),
    format: 'der',
    type: 'spki',
  })
  if (key.asymmetricKeyType !== 'x25519')
    throw new Error('An X25519 public key is required')
  return key
}
function derived(privateKey, peer, salt) {
  return Buffer.from(
    hkdfSync(
      'sha256',
      diffieHellman({ privateKey, publicKey: peer }),
      salt,
      INFO,
      32,
    ),
  )
}
function field(value, length) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+$/.test(value))
    throw new Error('Invalid encrypted envelope')
  const bytes = Buffer.from(value, 'base64url')
  if (length !== undefined && bytes.length !== length)
    throw new Error('Invalid encrypted envelope length')
  return bytes
}
function expectedCertificate() {
  const value = readFileSync(
    join(root, 'android/signing-certificate.sha256'),
    'utf8',
  )
    .trim()
    .toLowerCase()
  if (!/^[a-f0-9]{64}$/.test(value))
    throw new Error('Established signing certificate is missing')
  return value
}
function certificateMatches(bytes) {
  return (
    new X509Certificate(bytes).fingerprint256
      .replaceAll(':', '')
      .toLowerCase() === expectedCertificate()
  )
}
function unpackVerified(archive) {
  if (archive.length > 65536)
    throw new Error('Unexpectedly large signing backup')
  const files = unzipSync(archive, {
    filter: (file) => file.originalSize <= 65536,
  })
  const allowed = [
    'jido-next.p12',
    'signing.properties',
    'certificate.der',
    'RESTORE.txt',
  ]
  if (Object.keys(files).some((name) => !allowed.includes(name)))
    throw new Error('Unexpected file in signing backup')
  for (const name of allowed.slice(0, 3))
    if (!files[name]?.length) throw new Error('Incomplete signing backup')
  if (!certificateMatches(files['certificate.der']))
    throw new Error('Backup certificate does not match the established app')
  return files
}
function run() {
  const receiverDir = resolve(
    option('--receiver-dir', '/workspace/.jido-transfer'),
  )
  const receiverFile = join(receiverDir, 'receiver-private.pem')
  if (command === 'receiver') {
    mkdirSync(receiverDir, { recursive: true, mode: 0o700 })
    chmodSync(receiverDir, 0o700)
    if (!existsSync(receiverFile)) {
      const { privateKey } = generateKeyPairSync('x25519')
      privateFile(
        receiverFile,
        privateKey.export({ format: 'pem', type: 'pkcs8' }),
      )
    }
    chmodSync(receiverFile, 0o600)
    const privateKey = createPrivateKey(readFileSync(receiverFile))
    if (privateKey.asymmetricKeyType !== 'x25519')
      throw new Error(
        'Existing receiver key is not X25519; preserved without replacement',
      )
    console.log(PREFIX + encodedPublic(privateKey))
    return
  }
  if (command === 'encrypt') {
    const recipient = args
      .find((value) => value.startsWith(PREFIX))
      ?.slice(PREFIX.length)
    const peer = publicKey(recipient ?? '')
    const archive = readFileSync(
      option('--backup', '/tmp/JDo-signing-backup.zip'),
    )
    unpackVerified(archive)
    const { privateKey } = generateKeyPairSync('x25519')
    const salt = randomBytes(32)
    const iv = randomBytes(12)
    const cipher = createCipheriv(
      'aes-256-gcm',
      derived(privateKey, peer, salt),
      iv,
    )
    cipher.setAAD(Buffer.from(FORMAT + ':' + recipient))
    const ciphertext = Buffer.concat([cipher.update(archive), cipher.final()])
    const envelope = {
      format: FORMAT,
      recipient,
      ephemeral: encodedPublic(privateKey),
      salt: salt.toString('base64url'),
      iv: iv.toString('base64url'),
      tag: cipher.getAuthTag().toString('base64url'),
      ciphertext: ciphertext.toString('base64url'),
    }
    const output = resolve(
      option('--out', '/tmp/JDo-signing-transfer.encrypted.json'),
    )
    privateFile(output, JSON.stringify(envelope) + '\n')
    console.log(
      'Encrypted transfer created. Only the receiving environment can decrypt it.',
    )
    return
  }
  if (command !== 'restore')
    throw new Error('Use receiver, encrypt, or restore')
  const raw = readFileSync(
    option('--envelope', '/tmp/JDo-signing-transfer.encrypted.json'),
  )
  if (raw.length > 100000)
    throw new Error('Unexpectedly large encrypted envelope')
  const envelope = JSON.parse(raw)
  if (envelope.format !== FORMAT)
    throw new Error('Unsupported encrypted transfer format')
  const privateKey = createPrivateKey(readFileSync(receiverFile))
  if (encodedPublic(privateKey) !== envelope.recipient)
    throw new Error(
      'This transfer belongs to a different receiving environment',
    )
  const decipher = createDecipheriv(
    'aes-256-gcm',
    derived(
      privateKey,
      publicKey(envelope.ephemeral),
      field(envelope.salt, 32),
    ),
    field(envelope.iv, 12),
  )
  decipher.setAAD(Buffer.from(FORMAT + ':' + envelope.recipient))
  decipher.setAuthTag(field(envelope.tag, 16))
  const archive = Buffer.concat([
    decipher.update(field(envelope.ciphertext)),
    decipher.final(),
  ])
  const files = unpackVerified(archive)
  const properties = Object.fromEntries(
    Buffer.from(files['signing.properties'])
      .toString('utf8')
      .split(/\r?\n/)
      .filter((line) => line.trim() && !line.trim().startsWith('#'))
      .map((line) => {
        const index = line.indexOf('=')
        if (index < 1) throw new Error('Unsupported signing properties format')
        return [line.slice(0, index).trim(), line.slice(index + 1).trim()]
      }),
  )
  for (const name of ['keyAlias', 'storePassword', 'keyPassword'])
    if (!properties[name])
      throw new Error('Incomplete private signing properties')
  const destination = resolve(
    option('--destination', '/workspace/.jido-signing'),
  )
  mkdirSync(dirname(destination), { recursive: true, mode: 0o700 })
  const staging = mkdtempSync(
    join(dirname(destination), '.jido-signing-restore-'),
  )
  chmodSync(staging, 0o700)
  try {
    const keyPath = join(staging, 'jido-next.p12')
    privateFile(keyPath, files['jido-next.p12'])
    const keytool = existsSync('/workspace/.cache/jido-jdk-21/bin/keytool')
      ? '/workspace/.cache/jido-jdk-21/bin/keytool'
      : 'keytool'
    const check = spawnSync(
      keytool,
      [
        '-exportcert',
        '-storetype',
        'PKCS12',
        '-keystore',
        keyPath,
        '-alias',
        properties.keyAlias,
        '-storepass:env',
        'JIDO_TRANSFER_STORE_PASS',
      ],
      {
        env: {
          ...process.env,
          JIDO_TRANSFER_STORE_PASS: properties.storePassword,
        },
        maxBuffer: 1024 * 1024,
      },
    )
    if (check.error || check.status !== 0 || !certificateMatches(check.stdout))
      throw new Error('Private keystore verification failed; no key installed')
    properties.storeFile = join(destination, 'jido-next.p12')
    const config =
      Object.entries(properties)
        .map(([key, value]) => `${key}=${value}`)
        .join('\n') + '\n'
    privateFile(join(staging, 'signing.properties'), config)
    privateFile(join(staging, 'certificate.der'), files['certificate.der'])
    if (existsSync(destination)) {
      const existingKey = join(destination, 'jido-next.p12')
      const existingConfig = join(destination, 'signing.properties')
      if (
        existsSync(existingKey) &&
        existsSync(existingConfig) &&
        readFileSync(existingKey).equals(Buffer.from(files['jido-next.p12'])) &&
        readFileSync(existingConfig, 'utf8') === config
      ) {
        chmodSync(destination, 0o700)
        chmodSync(existingKey, 0o600)
        chmodSync(existingConfig, 0o600)
        console.log('The same signing key is already installed and verified.')
        return
      }
      if (readdirSync(destination).length)
        throw new Error(
          'Existing signing directory differs; preserved without overwriting',
        )
      rmdirSync(destination)
    }
    renameSync(staging, destination)
    console.log(
      'Existing signing key restored; certificate matches the established app. Private directory 700; files 600.',
    )
  } finally {
    if (existsSync(staging)) rmSync(staging, { recursive: true })
  }
}
try {
  run()
} catch {
  console.error(
    'Signing transfer failed. No private values were printed. Check the input files, recipient key, JDK, and existing destination; existing signing files were not overwritten.',
  )
  process.exitCode = 1
}
