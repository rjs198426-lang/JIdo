import additional from './additional-photo-credits.json' with { type: 'json' }
export type PhotoCreditInfo = {
  file: string
  author: string
  license: string
  licenseUrl: string
  sourceUrl: string
  verifiedAt: string
}
export const photoCredits: Record<string, PhotoCreditInfo> = {
  kiyomizu: {
    file: '/images/place-kiyomizu.jpg',
    author: 'Jordy Meow',
    license: 'CC BY-SA 3.0',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Kiyomizu.jpg',
    verifiedAt: '2026-10-14',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0',
  },
  ubud: {
    file: '/images/place-ubud.jpg',
    author: 'Vyacheslav Argenberg',
    license: 'CC BY 4.0',
    sourceUrl:
      'https://commons.wikimedia.org/wiki/File:Rice_terraces,_Bali.jpg',
    verifiedAt: '2026-10-14',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0',
  },
  'wat-arun': {
    file: '/images/place-wat-arun.jpg',
    author: 'Mastertongapollo',
    license: 'CC BY-SA 4.0',
    sourceUrl:
      'https://commons.wikimedia.org/wiki/File:%E0%B9%80%E0%B8%88%E0%B8%94%E0%B8%B5%E0%B8%A2%E0%B9%8C%E0%B8%9B%E0%B8%A3%E0%B8%B0%E0%B8%98%E0%B8%B2%E0%B8%99%E0%B8%97%E0%B8%A3%E0%B8%87%E0%B8%9B%E0%B8%A3%E0%B8%B2%E0%B8%87%E0%B8%84%E0%B9%8C%E0%B8%A7%E0%B8%B1%E0%B8%94%E0%B8%AD%E0%B8%A3%E0%B8%B8%E0%B8%932.jpg',
    verifiedAt: '2026-10-14',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
  },
  male: {
    file: '/images/place-male.jpg',
    author: 'Shahee Ilyas',
    license: 'CC BY-SA 3.0',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Mal%C3%A9.jpg',
    verifiedAt: '2026-10-14',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0',
  },
  'nagoya-osu': {
    file: '/images/place-nagoya-osu.jpg',
    author: 'Bariston',
    license: 'CC BY-SA 4.0',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Osu1.JPG',
    verifiedAt: '2026-10-14',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
  },
  'sapporo-clock': {
    file: '/images/place-sapporo-clock.jpg',
    author: 'Bjørn Christian Tørrissen',
    license: 'CC BY-SA 4.0',
    sourceUrl:
      'https://commons.wikimedia.org/wiki/File:Sapporo-Clock-Tower-2018.jpg',
    verifiedAt: '2026-10-14',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
  },
  'sapporo-tv-tower': {
    file: '/images/place-sapporo-tv-tower.jpg',
    author: 'AlphaBetaGamma',
    license: 'CC BY 4.0',
    sourceUrl:
      'https://commons.wikimedia.org/wiki/File:Sapporo-TV-Tower-2025.jpg',
    verifiedAt: '2026-10-14',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0',
  },
  'fukuoka-kushida': {
    file: '/images/place-fukuoka-kushida.jpg',
    author: 'Pontafon',
    license: 'CC BY-SA 3.0',
    sourceUrl:
      'https://commons.wikimedia.org/wiki/File:Kushidajinjafukuoka01.jpg',
    verifiedAt: '2026-10-14',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0',
  },
  'sendai-zuihoden': {
    file: '/images/place-sendai-zuihoden.jpg',
    author: '663highland',
    license: 'CC BY 2.5',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Zuiho-den17s3872.jpg',
    verifiedAt: '2026-10-14',
    licenseUrl: 'https://creativecommons.org/licenses/by/2.5',
  },
  'ubud-market': {
    file: '/images/place-ubud-market.jpg',
    author: 'Julia Kado',
    license: 'CC BY-SA 4.0',
    sourceUrl:
      'https://commons.wikimedia.org/wiki/File:Ubud_Market_in_Bali.jpg',
    verifiedAt: '2026-10-14',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
  },
  'ubud-coffee': {
    file: '/images/place-ubud-coffee.jpg',
    author: 'User: (WT-shared) Shoestring at wts wikivoyage',
    license: 'CC BY-SA 1.0',
    sourceUrl:
      'https://commons.wikimedia.org/wiki/File:Pundi-Pundi,_Ubud,_Bali.JPG',
    verifiedAt: '2026-10-14',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/1.0',
  },
  ammoudi: {
    file: '/images/place-ammoudi.jpg',
    author: 'Anthony Baratier',
    license: 'CC BY-SA 4.0',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Ammoudi_Bay.jpg',
    verifiedAt: '2026-10-14',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
  },
  hulhumale: {
    file: '/images/place-hulhumale.jpg',
    author: 'Saaremees',
    license: 'CC BY-SA 4.0',
    sourceUrl:
      'https://commons.wikimedia.org/wiki/File:Hulhumale_Beach-Maldives-Andres_Larin.jpg',
    verifiedAt: '2026-10-14',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
  },
  'male-market': {
    file: '/images/place-male-market.jpg',
    author: 'Mark Fischer',
    license: 'CC BY-SA 2.0',
    sourceUrl:
      'https://commons.wikimedia.org/wiki/File:A_fishmonger_prepares_to_clean_and_butcher_a_pair_of_large_fish_in_Mal%C3%A9.jpg',
    verifiedAt: '2026-10-14',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/2.0',
  },
  'fukuoka-tenjin': {
    file: '/images/place-fukuoka-tenjin.jpg',
    author: 'Hirho',
    license: 'CC BY-SA 4.0',
    sourceUrl:
      'https://commons.wikimedia.org/wiki/File:Tenjin-nishi_D%C5%8Dri_the_ENE_view_from_Kon-ya-machi_Sh%C5%8Dji_Tenjin_2-ch%C5%8Dme_Ch%C5%AB%C5%8D-ku_Fukuoka_20231114.jpg',
    verifiedAt: '2026-10-14',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
  },
  'sendai-jozenji': {
    file: '/images/place-sendai-jozenji.jpg',
    author: 'Los688',
    license: 'Public domain',
    sourceUrl:
      'https://commons.wikimedia.org/wiki/File:Jozenji-dori_Avenue_2005.jpg',
    verifiedAt: '2026-10-14',
    licenseUrl:
      'https://commons.wikimedia.org/wiki/File:Jozenji-dori_Avenue_2005.jpg',
  },
  fushimi: {
    file: '/images/place-fushimi.jpg',
    author: 'Basile Morin',
    license: 'CC BY-SA 4.0',
    sourceUrl:
      'https://commons.wikimedia.org/wiki/File:Torii_path_with_lantern_at_Fushimi_Inari_Taisha_Shrine,_Kyoto,_Japan.jpg',
    verifiedAt: '2026-10-14',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
  },
  nishiki: {
    file: '/images/place-nishiki.jpg',
    author: 'matsuyuki',
    license: 'CC BY-SA 2.0',
    sourceUrl:
      'https://commons.wikimedia.org/wiki/File:Nishiki_Ichiba_by_matsuyuki.jpg',
    verifiedAt: '2026-10-14',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/2.0',
  },
  gion: {
    file: '/images/place-gion.jpg',
    author: 'Moja',
    license: 'CC BY-SA 3.0',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Kyoto_gion01.jpg',
    verifiedAt: '2026-10-14',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
  },
  'kyoto-cafe': {
    file: '/images/place-kyoto-cafe.jpg',
    author: 'Andrea Schaffer from Sydney, Australia',
    license: 'CC BY 2.0',
    sourceUrl:
      'https://commons.wikimedia.org/wiki/File:Sannenzaka_street,_Kyoto_(3811257874).jpg',
    verifiedAt: '2026-10-14',
    licenseUrl: 'https://creativecommons.org/licenses/by/2.0',
  },
  uluwatu: {
    file: '/images/place-uluwatu.jpg',
    author: 'Paskuu',
    license: 'CC BY-SA 4.0',
    sourceUrl:
      'https://commons.wikimedia.org/wiki/File:Pura_Luhur_Uluwatu_2017-08-17_(34).jpg',
    verifiedAt: '2026-10-14',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
  },
  'grand-palace': {
    file: '/images/place-grand-palace.jpg',
    author: 'Preecha.MJ',
    license: 'CC BY-SA 4.0',
    sourceUrl:
      'https://commons.wikimedia.org/wiki/File:0005574_-_Wat_Phra_Kaew_006.jpg',
    verifiedAt: '2026-10-14',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
  },
  yaowarat: {
    file: '/images/place-yaowarat.jpg',
    author: 'กสิณธร ราชโอรส',
    license: 'CC BY-SA 4.0',
    sourceUrl:
      'https://commons.wikimedia.org/wiki/File:(2022)_%E0%B8%95%E0%B8%B6%E0%B8%81%E0%B9%81%E0%B8%96%E0%B8%A7%E0%B8%A3%E0%B8%B4%E0%B8%A1%E0%B8%96%E0%B8%99%E0%B8%99%E0%B9%80%E0%B8%A2%E0%B8%B2%E0%B8%A7%E0%B8%A3%E0%B8%B2%E0%B8%8A_%E0%B9%80%E0%B8%82%E0%B8%95%E0%B8%AA%E0%B8%B1%E0%B8%A1%E0%B8%9E%E0%B8%B1%E0%B8%99%E0%B8%98%E0%B8%A7%E0%B8%87%E0%B8%A8%E0%B9%8C_%E0%B8%81%E0%B8%A3%E0%B8%B8%E0%B8%87%E0%B9%80%E0%B8%97%E0%B8%9E%E0%B8%A1%E0%B8%AB%E0%B8%B2%E0%B8%99%E0%B8%84%E0%B8%A3_(4).jpg',
    verifiedAt: '2026-10-14',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
  },
  'talat-noi': {
    file: '/images/place-talat-noi.jpg',
    author: 'Chainwit.',
    license: 'CC BY-SA 4.0',
    sourceUrl:
      'https://commons.wikimedia.org/wiki/File:Rong_Kuak_Shrine_Talat_Noi_%E0%B8%A8%E0%B8%B2%E0%B8%A5%E0%B9%80%E0%B8%88%E0%B9%89%E0%B8%B2%E0%B9%82%E0%B8%A3%E0%B8%87%E0%B9%80%E0%B8%81%E0%B8%B7%E0%B8%AD%E0%B8%81_%E0%B8%95%E0%B8%A5%E0%B8%B2%E0%B8%94%E0%B8%99%E0%B9%89%E0%B8%AD%E0%B8%A2_2021_June.jpg',
    verifiedAt: '2026-10-14',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
  },
  oia: {
    file: '/images/place-oia.jpg',
    author: 'TomasEE',
    license: 'CC BY 3.0',
    sourceUrl:
      'https://commons.wikimedia.org/wiki/File:Oia_sunset_-_panoramio_(2).jpg',
    verifiedAt: '2026-10-14',
    licenseUrl: 'https://creativecommons.org/licenses/by/3.0',
  },
  fira: {
    file: '/images/place-fira.jpg',
    author: 'Tango7174',
    license: 'CC BY-SA 4.0',
    sourceUrl:
      'https://commons.wikimedia.org/wiki/File:Santorini_Fira3_tango7174.jpg',
    verifiedAt: '2026-10-14',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
  },
  burj: {
    file: '/images/place-burj.jpg',
    author: 'imran shahabuddin',
    license: 'CC BY 2.0',
    sourceUrl:
      'https://commons.wikimedia.org/wiki/File:Burj_Khalifa_(worlds_tallest_building)_and_the_Dubai_skyline_(25781049892).jpg',
    verifiedAt: '2026-10-14',
    licenseUrl: 'https://creativecommons.org/licenses/by/2.0',
  },
  'tokyo-sensoji': {
    file: '/images/place-tokyo-sensoji.jpg',
    author: 'Akonnchiroll',
    license: 'CC0',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Sensoji_2023.jpg',
    verifiedAt: '2026-10-14',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/deed.en',
  },
  'tokyo-meiji': {
    file: '/images/place-tokyo-meiji.jpg',
    author: 'Akonnchiroll',
    license: 'CC BY-SA 4.0',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Meiji_Jingu_2023-3.jpg',
    verifiedAt: '2026-10-14',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
  },
  'tokyo-shibuya': {
    file: '/images/place-tokyo-shibuya.jpg',
    author: 'David Kernan',
    license: 'CC BY 4.0',
    sourceUrl:
      'https://commons.wikimedia.org/wiki/File:Shibuya_Crossing,_Aerial.jpg',
    verifiedAt: '2026-10-14',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0',
  },
  'osaka-castle': {
    file: '/images/place-osaka-castle.jpg',
    author: '663highland',
    license: 'CC BY 2.5',
    sourceUrl:
      'https://commons.wikimedia.org/wiki/File:Osaka_Castle_03bs3200.jpg',
    verifiedAt: '2026-10-14',
    licenseUrl: 'https://creativecommons.org/licenses/by/2.5',
  },
  'osaka-dotonbori': {
    file: '/images/place-osaka-dotonbori.jpg',
    author: 'Type specimen',
    license: 'CC BY-SA 3.0',
    sourceUrl:
      'https://commons.wikimedia.org/wiki/File:Osaka_Dotonbori_Ebisu_Bridge.jpg',
    verifiedAt: '2026-10-14',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0',
  },
  'osaka-umeda-sky': {
    file: '/images/place-osaka-umeda-sky.jpg',
    author: 'Kakidai',
    license: 'CC BY-SA 4.0',
    sourceUrl:
      'https://commons.wikimedia.org/wiki/File:2018_Umeda_Sky_Building.jpg',
    verifiedAt: '2026-10-14',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
  },
  'yokohama-minatomirai': {
    file: '/images/place-yokohama-minatomirai.jpg',
    author: 'akumach from Kawasaki City, Japan',
    license: 'CC BY 2.0',
    sourceUrl:
      'https://commons.wikimedia.org/wiki/File:Minato_Mirai_In_Blue.jpg',
    verifiedAt: '2026-10-14',
    licenseUrl: 'https://creativecommons.org/licenses/by/2.0',
  },
  'yokohama-yamashita': {
    file: '/images/place-yokohama-yamashita.jpg',
    author: '外国人',
    license: 'CC BY 3.0',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Parque_Yamashita_2.JPG',
    verifiedAt: '2026-10-14',
    licenseUrl: 'https://creativecommons.org/licenses/by/3.0',
  },
  'yokohama-chinatown': {
    file: '/images/place-yokohama-chinatown.jpg',
    author: 'Wpcpey',
    license: 'CC BY-SA 4.0',
    sourceUrl:
      'https://commons.wikimedia.org/wiki/File:Yokohama_Chinatown_signage_2015.jpg',
    verifiedAt: '2026-10-14',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
  },
  'nagoya-castle': {
    file: '/images/place-nagoya-castle.jpg',
    author: 'Bariston',
    license: 'CC BY-SA 4.0',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Nagoya_Castle_7.jpg',
    verifiedAt: '2026-10-14',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
  },
  'nagoya-atsuta': {
    file: '/images/place-nagoya-atsuta.jpg',
    author: 'Bariston',
    license: 'CC BY-SA 4.0',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Atsuta_Shrine.jpg',
    verifiedAt: '2026-10-14',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
  },
  'sapporo-odori': {
    file: '/images/place-sapporo-odori.jpg',
    author: 'Nkns',
    license: 'CC BY-SA 3.0',
    sourceUrl:
      'https://commons.wikimedia.org/wiki/File:Hokkaido_Sapporo_Odori_Park.jpg',
    verifiedAt: '2026-10-14',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
  },
  'fukuoka-ohori': {
    file: '/images/place-fukuoka-ohori.jpg',
    author: 'Tzuhsun Hsu from Taipei, Taiwan',
    license: 'CC BY-SA 2.0',
    sourceUrl:
      'https://commons.wikimedia.org/wiki/File:%E5%A4%A7%E6%BF%A0%E5%85%AC%E5%9C%92_(3360365578).jpg',
    verifiedAt: '2026-10-14',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/2.0',
  },
  'hiroshima-peace-park': {
    file: '/images/place-hiroshima-peace-park.jpg',
    author: 'Balon Greyjoy',
    license: 'CC0',
    sourceUrl:
      'https://commons.wikimedia.org/wiki/File:20181111_Hiroshima_Memorial_Cenotaph-1.jpg',
    verifiedAt: '2026-10-14',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/deed.en',
  },
  'hiroshima-dome': {
    file: '/images/place-hiroshima-dome.jpg',
    author: 'Oilstreet',
    license: 'CC BY 2.5',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Genbaku_Dome04-r.JPG',
    verifiedAt: '2026-10-14',
    licenseUrl: 'https://creativecommons.org/licenses/by/2.5',
  },
  'hiroshima-shukkeien': {
    file: '/images/place-hiroshima-shukkeien.jpg',
    author:
      'No machine-readable author provided. Fg2 assumed (based on copyright claims).',
    license: 'Public domain',
    sourceUrl:
      'https://commons.wikimedia.org/wiki/File:Rainbow_bridge_in_Shukkei-en_Hiroshima.jpg',
    verifiedAt: '2026-10-14',
    licenseUrl:
      'https://commons.wikimedia.org/wiki/File:Rainbow_bridge_in_Shukkei-en_Hiroshima.jpg',
  },
  'kobe-harborland': {
    file: '/images/place-kobe-harborland.jpg',
    author: 'Mass Ave 975 at English Wikipedia',
    license: 'CC BY-SA 3.0',
    sourceUrl:
      'https://commons.wikimedia.org/wiki/File:Harborland_district.jpg',
    verifiedAt: '2026-10-14',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
  },
  'kobe-kitano': {
    file: '/images/place-kobe-kitano.jpg',
    author: '663highland',
    license: 'CC BY 2.5',
    sourceUrl:
      'https://commons.wikimedia.org/wiki/File:Kobe_kitano_thomas_house07_2816.jpg',
    verifiedAt: '2026-10-14',
    licenseUrl: 'https://creativecommons.org/licenses/by/2.5',
  },
  'kobe-rokko': {
    file: '/images/place-kobe-rokko.jpg',
    author: '663highland',
    license: 'CC BY 2.5',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Mt_rokko01s2816.jpg',
    verifiedAt: '2026-10-14',
    licenseUrl: 'https://creativecommons.org/licenses/by/2.5',
  },
  'sendai-castle': {
    file: '/images/place-sendai-castle.jpg',
    author: '掬茶',
    license: 'CC BY-SA 4.0',
    sourceUrl:
      'https://commons.wikimedia.org/wiki/File:Waki-yagura_of_Sendai_Castle_20220910b.jpg',
    verifiedAt: '2026-10-14',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
  },
  'al-fahidi': {
    file: '/images/place-al-fahidi.jpg',
    author: 'Delta.jpg',
    license: 'CC BY-SA 4.0',
    sourceUrl:
      'https://commons.wikimedia.org/wiki/File:Al_Fahidi_Historical_Neighbourhood,_Dubai.jpg',
    verifiedAt: '2026-10-14',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
  },
  'dubai-souk': {
    file: '/images/place-dubai-souk.jpg',
    author: 'Frodlekis',
    license: 'CC BY-SA 4.0',
    sourceUrl:
      'https://commons.wikimedia.org/wiki/File:Dubai_Spice_Souk_2018.jpg',
    verifiedAt: '2026-10-14',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
  },
  'dubai-review-2d9db81044cf': {
    file: '/images/dubai-review-2d9db81044cf.jpg',
    author: 'Rohitshiv',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
    sourceUrl:
      'https://commons.wikimedia.org/wiki/File:Waterfall%20%40Dubai%20Mall.jpg',
    verifiedAt: '2026-10-15',
  },
  'dubai-review-203e291fcce3': {
    file: '/images/dubai-review-203e291fcce3.jpg',
    author: 'Lxs',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
    sourceUrl:
      'https://commons.wikimedia.org/wiki/File:Entrance%20to%20Women%E2%80%99s%20Museum%20of%20Duba%C3%AF.jpg',
    verifiedAt: '2026-10-15',
  },
  'dubai-review-865ee0a091b0': {
    file: '/images/dubai-review-865ee0a091b0.jpg',
    author: 'Donaldytong',
    license: 'CC BY-SA 3.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
    sourceUrl:
      'https://commons.wikimedia.org/wiki/File:%28UAE%29%20The%20Dubai%20Fountain%20at%20Dusk%2002.jpg',
    verifiedAt: '2026-10-15',
  },
}

Object.assign(photoCredits, additional)
