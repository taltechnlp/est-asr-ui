import type { Word, Speaker } from '$lib/helpers/converters/types';
import { v4 as uuidv4 } from 'uuid';
export let words: Array<Word> = [];
export let speakers: Array<Speaker> = [];
export const content = {
    "type": "doc",
    "content": [
        {
            "type": "speaker",
            "attrs": {
                "data-name": "Reene Leas",
                "id": "1"
            },
            "content": [
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 11.35,
                                "end": 11.5
                            }
                        }
                    ],
                    "text": "Ta "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 11.74,
                                "end": 11.92
                            }
                        }
                    ],
                    "text": "on "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 11.92,
                                "end": 12.73
                            }
                        }
                    ],
                    "text": "16. "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 12.73,
                                "end": 13.03
                            }
                        }
                    ],
                    "text": "mai "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 13.03,
                                "end": 13.27
                            }
                        }
                    ],
                    "text": "kell "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 13.27,
                                "end": 13.48
                            }
                        }
                    ],
                    "text": "sai "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 13.48,
                                "end": 13.81
                            }
                        }
                    ],
                    "text": "kuus "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 13.81,
                                "end": 13.99
                            }
                        }
                    ],
                    "text": "ning "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 13.99,
                                "end": 14.5
                            }
                        }
                    ],
                    "text": "Päevakaja "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 14.5,
                                "end": 14.8
                            }
                        }
                    ],
                    "text": "võtab "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 14.8,
                                "end": 15.1
                            }
                        }
                    ],
                    "text": "kokku "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 15.1,
                                "end": 15.43
                            }
                        }
                    ],
                    "text": "tänase "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 15.43,
                                "end": 15.73
                            }
                        }
                    ],
                    "text": "päeva "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 15.73,
                                "end": 16.18
                            }
                        }
                    ],
                    "text": "tähtsamad "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 16.18,
                                "end": 16.63
                            }
                        }
                    ],
                    "text": "uudised. "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 16.66,
                                "end": 16.9
                            }
                        }
                    ],
                    "text": "Mina "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 16.9,
                                "end": 17.11
                            }
                        }
                    ],
                    "text": "olen "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 17.11,
                                "end": 17.38
                            }
                        }
                    ],
                    "text": "Reene "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 17.38,
                                "end": 17.74
                            }
                        }
                    ],
                    "text": "Leas. "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 18.34,
                                "end": 18.79
                            }
                        }
                    ],
                    "text": "Valitsus "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 18.79,
                                "end": 19.12
                            }
                        }
                    ],
                    "text": "sidus "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 19.12,
                                "end": 19.87
                            }
                        }
                    ],
                    "text": "lisaeelarve "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 19.87,
                                "end": 20.59
                            }
                        }
                    ],
                    "text": "vastuvõtmise "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 20.59,
                                "end": 21.25
                            }
                        }
                    ],
                    "text": "riigikogus "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 21.25,
                                "end": 22.27
                            }
                        }
                    ],
                    "text": "usaldusküsimusega."
                }
            ]
        },
        {
            "type": "speaker",
            "attrs": {
                "data-name": "Jüri Ratas",
                "id": null
            },
            "content": [
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 22.84,
                                "end": 23.38
                            }
                        }
                    ],
                    "text": "Survet "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 23.38,
                                "end": 23.5
                            }
                        }
                    ],
                    "text": "on "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 23.5,
                                "end": 24.1
                            }
                        }
                    ],
                    "text": "jaanipäeval "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 24.1,
                                "end": 24.31
                            }
                        }
                    ],
                    "text": "peaks "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 24.31,
                                "end": 24.55
                            }
                        }
                    ],
                    "text": "mingi "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 24.55,
                                "end": 24.76
                            }
                        }
                    ],
                    "text": "asja "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 24.76,
                                "end": 25.09
                            }
                        }
                    ],
                    "text": "vastu "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 25.09,
                                "end": 25.54
                            }
                        }
                    ],
                    "text": "mõtlema, "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 25.54,
                                "end": 25.78
                            }
                        }
                    ],
                    "text": "mis "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 25.78,
                                "end": 26.11
                            }
                        }
                    ],
                    "text": "toob "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 26.11,
                                "end": 26.41
                            }
                        }
                    ],
                    "text": "suuri "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 26.41,
                                "end": 26.98
                            }
                        }
                    ],
                    "text": "rahalisi "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 26.98,
                                "end": 27.79
                            }
                        }
                    ],
                    "text": "püsikulusid "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 28.36,
                                "end": 28.87
                            }
                        }
                    ],
                    "text": "ilma "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 28.87,
                                "end": 29.17
                            }
                        }
                    ],
                    "text": "selle "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 29.38,
                                "end": 29.59
                            }
                        }
                    ],
                    "text": "seda "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 29.59,
                                "end": 29.95
                            }
                        }
                    ],
                    "text": "eelarve "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 29.95,
                                "end": 30.43
                            }
                        }
                    ],
                    "text": "kontekstis "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 30.43,
                                "end": 31.12
                            }
                        }
                    ],
                    "text": "vaatamata, "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 31.12,
                                "end": 31.27
                            }
                        }
                    ],
                    "text": "et "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 31.27,
                                "end": 31.39
                            }
                        }
                    ],
                    "text": "noh, "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 31.39,
                                "end": 31.84
                            }
                        }
                    ],
                    "text": "tegelikult "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 31.84,
                                "end": 32.02
                            }
                        }
                    ],
                    "text": "seal "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 32.02,
                                "end": 32.08
                            }
                        }
                    ],
                    "text": "ei "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 32.08,
                                "end": 32.2
                            }
                        }
                    ],
                    "text": "ole "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 32.2,
                                "end": 32.53
                            }
                        }
                    ],
                    "text": "ühtegi "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 32.53,
                                "end": 33.01
                            }
                        }
                    ],
                    "text": "põhjust."
                }
            ]
        },
        {
            "type": "speaker",
            "attrs": {
                "data-name": "Reene Leas",
                "id": null
            },
            "content": [
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 33.92,
                                "end": 34.28
                            }
                        }
                    ],
                    "text": "Kaja "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 34.28,
                                "end": 34.82
                            }
                        }
                    ],
                    "text": "Kallas "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 34.91,
                                "end": 35.33
                            }
                        }
                    ],
                    "text": "kordas "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 35.33,
                                "end": 35.63
                            }
                        }
                    ],
                    "text": "varem "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 35.66,
                                "end": 36.05
                            }
                        }
                    ],
                    "text": "öeldut, "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 36.05,
                                "end": 36.2
                            }
                        }
                    ],
                    "text": "et "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 36.2,
                                "end": 36.47
                            }
                        }
                    ],
                    "text": "kui "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 36.47,
                                "end": 37.22
                            }
                        }
                    ],
                    "text": "Keskerakond "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 37.22,
                                "end": 37.49
                            }
                        }
                    ],
                    "text": "võtab "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 37.49,
                                "end": 37.73
                            }
                        }
                    ],
                    "text": "enne "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 37.73,
                                "end": 38.36
                            }
                        }
                    ],
                    "text": "jaanipäeva "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 38.36,
                                "end": 39.14
                            }
                        }
                    ],
                    "text": "peretoetuste "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 39.14,
                                "end": 39.47
                            }
                        }
                    ],
                    "text": "eelnõu "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 39.47,
                                "end": 39.83
                            }
                        }
                    ],
                    "text": "vastu "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 39.83,
                                "end": 40.13
                            }
                        }
                    ],
                    "text": "koos "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 40.13,
                                "end": 40.79
                            }
                        }
                    ],
                    "text": "opositsiooni "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 40.79,
                                "end": 41.36
                            }
                        }
                    ],
                    "text": "häältega "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 41.72,
                                "end": 41.99
                            }
                        }
                    ],
                    "text": "on "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 41.99,
                                "end": 42.41
                            }
                        }
                    ],
                    "text": "praegune "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 42.41,
                                "end": 43.01
                            }
                        }
                    ],
                    "text": "koalitsioon "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 43.07,
                                "end": 43.64
                            }
                        }
                    ],
                    "text": "lõpetanud "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 43.64,
                                "end": 44.24
                            }
                        }
                    ],
                    "text": "töötamise. "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 44.57,
                                "end": 45.26
                            }
                        }
                    ],
                    "text": "Keskerakonna "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 45.26,
                                "end": 45.62
                            }
                        }
                    ],
                    "text": "esimees "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 45.62,
                                "end": 45.86
                            }
                        }
                    ],
                    "text": "Jüri "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 45.86,
                                "end": 46.25
                            }
                        }
                    ],
                    "text": "Ratas "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 46.25,
                                "end": 46.64
                            }
                        }
                    ],
                    "text": "nimetas "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 46.64,
                                "end": 47.09
                            }
                        }
                    ],
                    "text": "Kallase "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 47.09,
                                "end": 47.48
                            }
                        }
                    ],
                    "text": "sellist "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 47.48,
                                "end": 48.2
                            }
                        }
                    ],
                    "text": "väljaütlemist "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 48.2,
                                "end": 49.04
                            }
                        }
                    ],
                    "text": "ultimaatumiga."
                }
            ]
        },
        {
            "type": "speaker",
            "attrs": {
                "data-name": "Jüri Ratas",
                "id": null
            },
            "content": [
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 49.44,
                                "end": 49.77
                            }
                        }
                    ],
                    "text": "Ma "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 49.77,
                                "end": 50.1
                            }
                        }
                    ],
                    "text": "arvan, "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 50.1,
                                "end": 50.25
                            }
                        }
                    ],
                    "text": "et "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 50.25,
                                "end": 50.82
                            }
                        }
                    ],
                    "text": "peaministri "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 50.82,
                                "end": 51.03
                            }
                        }
                    ],
                    "text": "poolt "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 51.03,
                                "end": 51.33
                            }
                        }
                    ],
                    "text": "välja "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 51.33,
                                "end": 51.9
                            }
                        }
                    ],
                    "text": "öeldu, "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 51.9,
                                "end": 52.2
                            }
                        }
                    ],
                    "text": "et "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 52.26,
                                "end": 52.44
                            }
                        }
                    ],
                    "text": "kui "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 52.44,
                                "end": 52.56
                            }
                        }
                    ],
                    "text": "see "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 52.56,
                                "end": 52.83
                            }
                        }
                    ],
                    "text": "eelnõu "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 52.83,
                                "end": 53.1
                            }
                        }
                    ],
                    "text": "vastu "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 53.1,
                                "end": 53.85
                            }
                        }
                    ],
                    "text": "võetakse, "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 54.27,
                                "end": 54.51
                            }
                        }
                    ],
                    "text": "et "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 54.51,
                                "end": 54.78
                            }
                        }
                    ],
                    "text": "siis "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 54.81,
                                "end": 55.29
                            }
                        }
                    ],
                    "text": "koalitsioon "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 55.29,
                                "end": 55.8
                            }
                        }
                    ],
                    "text": "lõpetab, "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 55.8,
                                "end": 55.92
                            }
                        }
                    ],
                    "text": "et "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 55.92,
                                "end": 56.25
                            }
                        }
                    ],
                    "text": "see "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 56.28,
                                "end": 57
                            }
                        }
                    ],
                    "text": "ultimaatum "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 57,
                                "end": 57.09
                            }
                        }
                    ],
                    "text": "ei "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 57.09,
                                "end": 57.24
                            }
                        }
                    ],
                    "text": "ole "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 57.24,
                                "end": 57.72
                            }
                        }
                    ],
                    "text": "mõistlik."
                }
            ]
        },
        {
            "type": "speaker",
            "attrs": {
                "data-name": "Reene Leas",
                "id": null
            },
            "content": [
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 58.82,
                                "end": 59.3
                            }
                        }
                    ],
                    "text": "Ukraina "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 59.3,
                                "end": 59.57
                            }
                        }
                    ],
                    "text": "väed "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 59.57,
                                "end": 59.96
                            }
                        }
                    ],
                    "text": "jõudsid "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 59.96,
                                "end": 60.38
                            }
                        }
                    ],
                    "text": "Harkivi "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 60.38,
                                "end": 60.86
                            }
                        }
                    ],
                    "text": "lähedal "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 60.92,
                                "end": 61.31
                            }
                        }
                    ],
                    "text": "Venemaa "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 61.31,
                                "end": 61.82
                            }
                        }
                    ],
                    "text": "piirini "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 62.18,
                                "end": 62.72
                            }
                        }
                    ],
                    "text": "Brüsselis "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 62.72,
                                "end": 63.26
                            }
                        }
                    ],
                    "text": "kogunesid "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 63.26,
                                "end": 63.68
                            }
                        }
                    ],
                    "text": "Euroopa "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 63.68,
                                "end": 63.92
                            }
                        }
                    ],
                    "text": "Liidu "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 63.92,
                                "end": 64.79
                            }
                        }
                    ],
                    "text": "välisministrid, "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 64.85,
                                "end": 65.24
                            }
                        }
                    ],
                    "text": "Leedu "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 65.24,
                                "end": 65.69
                            }
                        }
                    ],
                    "text": "hinnangul "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 65.69,
                                "end": 66.02
                            }
                        }
                    ],
                    "text": "hoiab "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 66.02,
                                "end": 66.29
                            }
                        }
                    ],
                    "text": "üks "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 66.29,
                                "end": 66.62
                            }
                        }
                    ],
                    "text": "riik "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 66.62,
                                "end": 67.13
                            }
                        }
                    ],
                    "text": "ülejäänud "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 67.13,
                                "end": 67.55
                            }
                        }
                    ],
                    "text": "liikmeid "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 67.55,
                                "end": 68.24
                            }
                        }
                    ],
                    "text": "pantvangis."
                }
            ]
        },
        {
            "type": "speaker",
            "attrs": {
                "data-name": "Reene Leas",
                "id": null
            },
            "content": [
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 75.89,
                                "end": 76.52
                            }
                        }
                    ],
                    "text": "Riigikogu "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 76.52,
                                "end": 77
                            }
                        }
                    ],
                    "text": "eelarve "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 77,
                                "end": 77.45
                            }
                        }
                    ],
                    "text": "kontrolli "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 77.45,
                                "end": 78.23
                            }
                        }
                    ],
                    "text": "erikomisjoni "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 78.23,
                                "end": 78.65
                            }
                        }
                    ],
                    "text": "istungil "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 78.65,
                                "end": 79.04
                            }
                        }
                    ],
                    "text": "leiti, "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 79.04,
                                "end": 79.16
                            }
                        }
                    ],
                    "text": "et "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 79.16,
                                "end": 79.85
                            }
                        }
                    ],
                    "text": "hinnatõusu "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 79.85,
                                "end": 80.45
                            }
                        }
                    ],
                    "text": "mõjusid "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 80.57,
                                "end": 80.99
                            }
                        }
                    ],
                    "text": "saab "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 81.02,
                                "end": 81.56
                            }
                        }
                    ],
                    "text": "leevendada "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 81.56,
                                "end": 82.37
                            }
                        }
                    ],
                    "text": "maksusüsteemi "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 82.37,
                                "end": 83.18
                            }
                        }
                    ],
                    "text": "korrigeerimise "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 83.18,
                                "end": 83.36
                            }
                        }
                    ],
                    "text": "ja "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 83.36,
                                "end": 84.05
                            }
                        }
                    ],
                    "text": "CO2 "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 84.05,
                                "end": 84.47
                            }
                        }
                    ],
                    "text": "hinna "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 84.5,
                                "end": 85.43
                            }
                        }
                    ],
                    "text": "fikseerimisega. "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 86.09,
                                "end": 86.66
                            }
                        }
                    ],
                    "text": "Kodumaise "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 86.66,
                                "end": 87.05
                            }
                        }
                    ],
                    "text": "tomati "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 87.05,
                                "end": 87.14
                            }
                        }
                    ],
                    "text": "ja "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 87.14,
                                "end": 88.22
                            }
                        }
                    ],
                    "text": "kurgitootmine "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 88.22,
                                "end": 88.37
                            }
                        }
                    ],
                    "text": "on "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 88.37,
                                "end": 88.82
                            }
                        }
                    ],
                    "text": "kallinenud "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 88.85,
                                "end": 89.63
                            }
                        }
                    ],
                    "text": "mitukümmend "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 89.63,
                                "end": 90.26
                            }
                        }
                    ],
                    "text": "protsenti, "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 90.26,
                                "end": 90.59
                            }
                        }
                    ],
                    "text": "samas "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 90.59,
                                "end": 90.83
                            }
                        }
                    ],
                    "text": "pole "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 90.83,
                                "end": 91.28
                            }
                        }
                    ],
                    "text": "võimalik "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 91.28,
                                "end": 91.76
                            }
                        }
                    ],
                    "text": "tarbija "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 91.76,
                                "end": 92.09
                            }
                        }
                    ],
                    "text": "jaoks "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 92.09,
                                "end": 92.36
                            }
                        }
                    ],
                    "text": "hinda "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 92.36,
                                "end": 92.78
                            }
                        }
                    ],
                    "text": "tõsta. "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 93.35,
                                "end": 93.74
                            }
                        }
                    ],
                    "text": "Karl "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 93.77,
                                "end": 94.19
                            }
                        }
                    ],
                    "text": "Eduard "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 94.19,
                                "end": 94.55
                            }
                        }
                    ],
                    "text": "Söödi "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 94.55,
                                "end": 95.06
                            }
                        }
                    ],
                    "text": "nimelise "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 95.06,
                                "end": 95.69
                            }
                        }
                    ],
                    "text": "lasteluule "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 95.69,
                                "end": 96.2
                            }
                        }
                    ],
                    "text": "auhinna "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 96.2,
                                "end": 96.38
                            }
                        }
                    ],
                    "text": "sai "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 96.38,
                                "end": 96.8
                            }
                        }
                    ],
                    "text": "tänavu "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 96.83,
                                "end": 97.37
                            }
                        }
                    ],
                    "text": "Inreko "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 97.45,
                                "end": 98.29
                            }
                        }
                    ],
                    "text": "raamatuga, "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 98.29,
                                "end": 98.65
                            }
                        }
                    ],
                    "text": "kuhu "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 98.68,
                                "end": 99.1
                            }
                        }
                    ],
                    "text": "lapsed "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 99.1,
                                "end": 99.46
                            }
                        }
                    ],
                    "text": "said. "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 100.27,
                                "end": 100.87
                            }
                        }
                    ],
                    "text": "Jäähoki "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 100.87,
                                "end": 102.13
                            }
                        }
                    ],
                    "text": "maailmameistrivõistlustel "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 102.13,
                                "end": 102.58
                            }
                        }
                    ],
                    "text": "Soomes "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 102.58,
                                "end": 102.76
                            }
                        }
                    ],
                    "text": "on "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 102.76,
                                "end": 103.21
                            }
                        }
                    ],
                    "text": "alanud "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 103.24,
                                "end": 103.66
                            }
                        }
                    ],
                    "text": "kolmanda "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 103.66,
                                "end": 103.96
                            }
                        }
                    ],
                    "text": "vooru "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 103.96,
                                "end": 104.38
                            }
                        }
                    ],
                    "text": "mängud. "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 104.44,
                                "end": 104.92
                            }
                        }
                    ],
                    "text": "Läti "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 104.95,
                                "end": 105.43
                            }
                        }
                    ],
                    "text": "jahib "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 105.43,
                                "end": 105.7
                            }
                        }
                    ],
                    "text": "oma "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 105.7,
                                "end": 106.18
                            }
                        }
                    ],
                    "text": "esimest "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 106.18,
                                "end": 107.05
                            }
                        }
                    ],
                    "text": "turniirivõitu "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 107.08,
                                "end": 107.41
                            }
                        }
                    ],
                    "text": "Norra "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 107.41,
                                "end": 107.83
                            }
                        }
                    ],
                    "text": "vastu. "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 108.87,
                                "end": 109.05
                            }
                        }
                    ],
                    "text": "Nii "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 109.08,
                                "end": 109.41
                            }
                        }
                    ],
                    "text": "öösel "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 109.41,
                                "end": 109.59
                            }
                        }
                    ],
                    "text": "kui "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 109.59,
                                "end": 109.71
                            }
                        }
                    ],
                    "text": "ka "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 109.71,
                                "end": 109.98
                            }
                        }
                    ],
                    "text": "homme "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 109.98,
                                "end": 110.43
                            }
                        }
                    ],
                    "text": "päeval "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 110.43,
                                "end": 110.64
                            }
                        }
                    ],
                    "text": "võib "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 110.64,
                                "end": 111.03
                            }
                        }
                    ],
                    "text": "sadada "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 111.03,
                                "end": 111.78
                            }
                        }
                    ],
                    "text": "hoovihma. "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 112.23,
                                "end": 112.59
                            }
                        }
                    ],
                    "text": "Öösel "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 112.59,
                                "end": 112.71
                            }
                        }
                    ],
                    "text": "on "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 112.71,
                                "end": 113.1
                            }
                        }
                    ],
                    "text": "sooja "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 113.1,
                                "end": 113.37
                            }
                        }
                    ],
                    "text": "kaks "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 113.37,
                                "end": 113.58
                            }
                        }
                    ],
                    "text": "kuni "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 113.58,
                                "end": 113.94
                            }
                        }
                    ],
                    "text": "seitse "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 113.94,
                                "end": 114.42
                            }
                        }
                    ],
                    "text": "kraadi, "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 114.45,
                                "end": 114.72
                            }
                        }
                    ],
                    "text": "homme "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 114.72,
                                "end": 115.14
                            }
                        }
                    ],
                    "text": "päeval "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 115.14,
                                "end": 115.53
                            }
                        }
                    ],
                    "text": "aga "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 115.77,
                                "end": 116.13
                            }
                        }
                    ],
                    "text": "seitse "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 116.13,
                                "end": 116.37
                            }
                        }
                    ],
                    "text": "kuni "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 116.37,
                                "end": 116.82
                            }
                        }
                    ],
                    "text": "12 "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 116.82,
                                "end": 117.27
                            }
                        }
                    ],
                    "text": "kraadi."
                }
            ]
        },
        {
            "type": "speaker",
            "attrs": {
                "data-name": "Reene Leas",
                "id": null
            },
            "content": [
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 123.01,
                                "end": 123.52
                            }
                        }
                    ],
                    "text": "Valitsus "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 123.52,
                                "end": 123.91
                            }
                        }
                    ],
                    "text": "kiitis "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 123.91,
                                "end": 124.57
                            }
                        }
                    ],
                    "text": "erakorralisel "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 124.57,
                                "end": 125.02
                            }
                        }
                    ],
                    "text": "istungil "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 125.02,
                                "end": 125.35
                            }
                        }
                    ],
                    "text": "heaks "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 125.35,
                                "end": 125.8
                            }
                        }
                    ],
                    "text": "otsuse "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 125.8,
                                "end": 126.22
                            }
                        }
                    ],
                    "text": "siduda "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 126.22,
                                "end": 127.18
                            }
                        }
                    ],
                    "text": "lisaeelarve "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 127.21,
                                "end": 127.42
                            }
                        }
                    ],
                    "text": "ja "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 127.42,
                                "end": 127.78
                            }
                        }
                    ],
                    "text": "sellega "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 127.78,
                                "end": 128.23
                            }
                        }
                    ],
                    "text": "seotud "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 128.23,
                                "end": 128.53
                            }
                        }
                    ],
                    "text": "kolm "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 128.59,
                                "end": 128.92
                            }
                        }
                    ],
                    "text": "kolme "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 128.92,
                                "end": 129.4
                            }
                        }
                    ],
                    "text": "seaduse "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 129.4,
                                "end": 129.85
                            }
                        }
                    ],
                    "text": "eelnõu "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 129.85,
                                "end": 130.69
                            }
                        }
                    ],
                    "text": "riigikogus "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 130.81,
                                "end": 131.08
                            }
                        }
                    ],
                    "text": "enne "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 131.08,
                                "end": 131.38
                            }
                        }
                    ],
                    "text": "teist "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 131.38,
                                "end": 131.98
                            }
                        }
                    ],
                    "text": "lugemist "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 131.98,
                                "end": 133.15
                            }
                        }
                    ],
                    "text": "usaldusküsimusega "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 133.72,
                                "end": 134.29
                            }
                        }
                    ],
                    "text": "valitsuste "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 134.32,
                                "end": 134.95
                            }
                        }
                    ],
                    "text": "parlamendile "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 134.95,
                                "end": 135.49
                            }
                        }
                    ],
                    "text": "ettepaneku "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 135.49,
                                "end": 135.91
                            }
                        }
                    ],
                    "text": "arutada "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 135.91,
                                "end": 136.45
                            }
                        }
                    ],
                    "text": "eelnõusid "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 136.45,
                                "end": 137.08
                            }
                        }
                    ],
                    "text": "riigikogus, "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 137.08,
                                "end": 137.65
                            }
                        }
                    ],
                    "text": "ülehomme. "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 138.04,
                                "end": 138.49
                            }
                        }
                    ],
                    "text": "EKRE "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 138.49,
                                "end": 138.61
                            }
                        }
                    ],
                    "text": "on "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 138.61,
                                "end": 139.15
                            }
                        }
                    ],
                    "text": "esitanud "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 139.15,
                                "end": 140.08
                            }
                        }
                    ],
                    "text": "lisaeelarvele "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 140.11,
                                "end": 140.32
                            }
                        }
                    ],
                    "text": "ja "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 140.32,
                                "end": 140.65
                            }
                        }
                    ],
                    "text": "sellega "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 140.65,
                                "end": 141.07
                            }
                        }
                    ],
                    "text": "seotud "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 141.07,
                                "end": 141.7
                            }
                        }
                    ],
                    "text": "eelnõudele "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 141.7,
                                "end": 141.91
                            }
                        }
                    ],
                    "text": "üle "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 141.91,
                                "end": 142.36
                            }
                        }
                    ],
                    "text": "600 "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 142.36,
                                "end": 143.5
                            }
                        }
                    ],
                    "text": "muudatusettepaneku, "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 143.83,
                                "end": 144.1
                            }
                        }
                    ],
                    "text": "mis "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 144.1,
                                "end": 144.61
                            }
                        }
                    ],
                    "text": "võimaldab "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 144.61,
                                "end": 145.09
                            }
                        }
                    ],
                    "text": "venitada "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 145.09,
                                "end": 145.66
                            }
                        }
                    ],
                    "text": "eelnõude "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 145.66,
                                "end": 146.14
                            }
                        }
                    ],
                    "text": "arutelu "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 146.14,
                                "end": 146.77
                            }
                        }
                    ],
                    "text": "parlamendis "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 146.77,
                                "end": 146.89
                            }
                        }
                    ],
                    "text": "ja "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 146.89,
                                "end": 147.52
                            }
                        }
                    ],
                    "text": "blokeerida "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 147.52,
                                "end": 148.24
                            }
                        }
                    ],
                    "text": "riigikogu "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 148.3,
                                "end": 148.99
                            }
                        }
                    ],
                    "text": "tavapärase "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 148.99,
                                "end": 149.26
                            }
                        }
                    ],
                    "text": "töö "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 149.89,
                                "end": 150.31
                            }
                        }
                    ],
                    "text": "kokku "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 150.31,
                                "end": 150.4
                            }
                        }
                    ],
                    "text": "on "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 150.4,
                                "end": 151.24
                            }
                        }
                    ],
                    "text": "lisaeelarvele "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 151.24,
                                "end": 151.33
                            }
                        }
                    ],
                    "text": "ja "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 151.33,
                                "end": 151.66
                            }
                        }
                    ],
                    "text": "sellega "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 151.66,
                                "end": 152.05
                            }
                        }
                    ],
                    "text": "seotud "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 152.05,
                                "end": 152.53
                            }
                        }
                    ],
                    "text": "seaduste "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 152.53,
                                "end": 153.22
                            }
                        }
                    ],
                    "text": "eelnõud-le "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 153.31,
                                "end": 154.3
                            }
                        }
                    ],
                    "text": "esitatud "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 154.33,
                                "end": 154.72
                            }
                        }
                    ],
                    "text": "üle "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 154.72,
                                "end": 155.38
                            }
                        }
                    ],
                    "text": "700 "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 155.38,
                                "end": 156.52
                            }
                        }
                    ],
                    "text": "muudatusettepaneku. "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 157.62,
                                "end": 158.01
                            }
                        }
                    ],
                    "text": "Lisaks "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 158.01,
                                "end": 158.34
                            }
                        }
                    ],
                    "text": "riigi "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 158.34,
                                "end": 158.64
                            }
                        }
                    ],
                    "text": "selle "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 158.64,
                                "end": 159
                            }
                        }
                    ],
                    "text": "aasta "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 159,
                                "end": 159.81
                            }
                        }
                    ],
                    "text": "lisaeelarve "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 159.81,
                                "end": 160.26
                            }
                        }
                    ],
                    "text": "seaduse "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 160.26,
                                "end": 160.92
                            }
                        }
                    ],
                    "text": "eelnõule "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 160.95,
                                "end": 161.37
                            }
                        }
                    ],
                    "text": "sidus "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 161.37,
                                "end": 161.85
                            }
                        }
                    ],
                    "text": "valitsus "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 161.85,
                                "end": 162.96
                            }
                        }
                    ],
                    "text": "usaldusküsimusega "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 162.96,
                                "end": 163.23
                            }
                        }
                    ],
                    "text": "ka "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 163.26,
                                "end": 164.16
                            }
                        }
                    ],
                    "text": "peretoetuste "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 164.16,
                                "end": 164.61
                            }
                        }
                    ],
                    "text": "seaduse "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 164.61,
                                "end": 165.09
                            }
                        }
                    ],
                    "text": "muutmise "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 165.09,
                                "end": 165.54
                            }
                        }
                    ],
                    "text": "eelnõu. "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 166.08,
                                "end": 166.89
                            }
                        }
                    ],
                    "text": "Peretoetuste "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 166.89,
                                "end": 167.46
                            }
                        }
                    ],
                    "text": "tõstmine "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 167.46,
                                "end": 167.58
                            }
                        }
                    ],
                    "text": "ja "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 167.58,
                                "end": 167.85
                            }
                        }
                    ],
                    "text": "selle "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 167.85,
                                "end": 168.48
                            }
                        }
                    ],
                    "text": "ajakava "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 168.48,
                                "end": 168.78
                            }
                        }
                    ],
                    "text": "oli "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 168.78,
                                "end": 169.32
                            }
                        }
                    ],
                    "text": "arutuse "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 169.32,
                                "end": 169.68
                            }
                        }
                    ],
                    "text": "all "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 169.74,
                                "end": 170.1
                            }
                        }
                    ],
                    "text": "täna "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 170.1,
                                "end": 170.31
                            }
                        }
                    ],
                    "text": "ka "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 170.31,
                                "end": 170.94
                            }
                        }
                    ],
                    "text": "riigikogu "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 170.94,
                                "end": 172.08
                            }
                        }
                    ],
                    "text": "sotsiaalkomisjonis. "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 172.11,
                                "end": 172.59
                            }
                        }
                    ],
                    "text": "Margitta "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 172.59,
                                "end": 172.95
                            }
                        }
                    ],
                    "text": "otsmaa "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 172.95,
                                "end": 173.16
                            }
                        }
                    ],
                    "text": "teeb "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 173.16,
                                "end": 173.76
                            }
                        }
                    ],
                    "text": "ülevaate."
                }
            ]
        },
        {
            "type": "speaker",
            "attrs": {
                "data-name": "Margitta Otsmaa",
                "id": null
            },
            "content": [
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 174.51,
                                "end": 175.23
                            }
                        }
                    ],
                    "text": "Ettepaneku "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 175.23,
                                "end": 175.83
                            }
                        }
                    ],
                    "text": "esitajat "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 175.83,
                                "end": 176.1
                            }
                        }
                    ],
                    "text": "ehk "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 176.16,
                                "end": 176.88
                            }
                        }
                    ],
                    "text": "Keskerakonna, "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 176.88,
                                "end": 177.33
                            }
                        }
                    ],
                    "text": "Isamaa, "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 177.33,
                                "end": 178.47
                            }
                        }
                    ],
                    "text": "Sotsiaaldemokraatide "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 178.47,
                                "end": 178.56
                            }
                        }
                    ],
                    "text": "ja "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 178.56,
                                "end": 178.89
                            }
                        }
                    ],
                    "text": "EKRE "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 178.89,
                                "end": 179.22
                            }
                        }
                    ],
                    "text": "soov "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 179.22,
                                "end": 179.4
                            }
                        }
                    ],
                    "text": "on "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 179.46,
                                "end": 180.3
                            }
                        }
                    ],
                    "text": "lastetoetusi "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 180.3,
                                "end": 180.69
                            }
                        }
                    ],
                    "text": "tõsta "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 180.69,
                                "end": 181.11
                            }
                        }
                    ],
                    "text": "alates "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 181.11,
                                "end": 181.74
                            }
                        }
                    ],
                    "text": "veebruarist "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 181.77,
                                "end": 183.03
                            }
                        }
                    ],
                    "text": "2023 "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 183.03,
                                "end": 183.27
                            }
                        }
                    ],
                    "text": "ehk "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 183.33,
                                "end": 183.69
                            }
                        }
                    ],
                    "text": "kuus "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 183.72,
                                "end": 184.23
                            }
                        }
                    ],
                    "text": "järgmise "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 184.23,
                                "end": 184.5
                            }
                        }
                    ],
                    "text": "aasta "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 184.5,
                                "end": 185.13
                            }
                        }
                    ],
                    "text": "eelarvega. "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 185.54,
                                "end": 186.41
                            }
                        }
                    ],
                    "text": "Reformierakond "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 186.41,
                                "end": 186.59
                            }
                        }
                    ],
                    "text": "on "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 186.65,
                                "end": 187.43
                            }
                        }
                    ],
                    "text": "lastetoetuse "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 187.43,
                                "end": 187.85
                            }
                        }
                    ],
                    "text": "tõstmise "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 187.85,
                                "end": 188.24
                            }
                        }
                    ],
                    "text": "poolt, "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 188.24,
                                "end": 188.48
                            }
                        }
                    ],
                    "text": "aga "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 188.48,
                                "end": 188.9
                            }
                        }
                    ],
                    "text": "soovib "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 188.93,
                                "end": 189.38
                            }
                        }
                    ],
                    "text": "eelnõu "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 189.38,
                                "end": 189.98
                            }
                        }
                    ],
                    "text": "arutamiseks "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 189.98,
                                "end": 190.43
                            }
                        }
                    ],
                    "text": "aega, "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 190.43,
                                "end": 190.67
                            }
                        }
                    ],
                    "text": "sest "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 190.67,
                                "end": 191.15
                            }
                        }
                    ],
                    "text": "ettepanek "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 191.15,
                                "end": 191.54
                            }
                        }
                    ],
                    "text": "nõuaks "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 191.54,
                                "end": 191.84
                            }
                        }
                    ],
                    "text": "ligi "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 191.84,
                                "end": 192.35
                            }
                        }
                    ],
                    "text": "300 "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 192.35,
                                "end": 192.8
                            }
                        }
                    ],
                    "text": "miljonit "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 192.83,
                                "end": 193.34
                            }
                        }
                    ],
                    "text": "täiendavat "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 193.34,
                                "end": 193.64
                            }
                        }
                    ],
                    "text": "eurot "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 193.64,
                                "end": 194.09
                            }
                        }
                    ],
                    "text": "aastas "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 194.33,
                                "end": 194.51
                            }
                        }
                    ],
                    "text": "ja "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 194.51,
                                "end": 194.75
                            }
                        }
                    ],
                    "text": "pole "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 194.75,
                                "end": 195.08
                            }
                        }
                    ],
                    "text": "selge, "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 195.08,
                                "end": 195.41
                            }
                        }
                    ],
                    "text": "kust "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 195.44,
                                "end": 195.77
                            }
                        }
                    ],
                    "text": "leida "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 195.77,
                                "end": 196.13
                            }
                        }
                    ],
                    "text": "sellele. "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 196.99,
                                "end": 197.5
                            }
                        }
                    ],
                    "text": "Tegemist "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 197.5,
                                "end": 197.68
                            }
                        }
                    ],
                    "text": "on "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 197.74,
                                "end": 198.28
                            }
                        }
                    ],
                    "text": "tuleviku "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 198.28,
                                "end": 198.94
                            }
                        }
                    ],
                    "text": "püsikuluga "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 198.94,
                                "end": 199.12
                            }
                        }
                    ],
                    "text": "ja "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 199.12,
                                "end": 199.39
                            }
                        }
                    ],
                    "text": "seda "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 199.39,
                                "end": 199.6
                            }
                        }
                    ],
                    "text": "saab "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 199.6,
                                "end": 199.87
                            }
                        }
                    ],
                    "text": "katta "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 199.87,
                                "end": 200.08
                            }
                        }
                    ],
                    "text": "kas "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 200.08,
                                "end": 200.38
                            }
                        }
                    ],
                    "text": "mingi "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 200.38,
                                "end": 200.62
                            }
                        }
                    ],
                    "text": "muu "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 200.62,
                                "end": 201.25
                            }
                        }
                    ],
                    "text": "püsikuluga, "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 201.35,
                                "end": 201.74
                            }
                        }
                    ],
                    "text": "õppimise "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 201.74,
                                "end": 201.92
                            }
                        }
                    ],
                    "text": "või "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 201.95,
                                "end": 202.7
                            }
                        }
                    ],
                    "text": "ärajätmisega "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 202.7,
                                "end": 202.94
                            }
                        }
                    ],
                    "text": "või "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 202.97,
                                "end": 203.99
                            }
                        }
                    ],
                    "text": "maksutõusudega. "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 204.47,
                                "end": 205.28
                            }
                        }
                    ],
                    "text": "Keskfraktsiooni "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 205.28,
                                "end": 205.52
                            }
                        }
                    ],
                    "text": "juhi "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 205.52,
                                "end": 205.79
                            }
                        }
                    ],
                    "text": "Jaanus "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 205.79,
                                "end": 206.27
                            }
                        }
                    ],
                    "text": "Karilaiu "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 206.27,
                                "end": 206.54
                            }
                        }
                    ],
                    "text": "sõnul "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 206.54,
                                "end": 206.81
                            }
                        }
                    ],
                    "text": "pole "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 206.81,
                                "end": 207.05
                            }
                        }
                    ],
                    "text": "see "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 207.05,
                                "end": 207.47
                            }
                        }
                    ],
                    "text": "kulu "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 207.53,
                                "end": 207.83
                            }
                        }
                    ],
                    "text": "vaid "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 207.83,
                                "end": 208.58
                            }
                        }
                    ],
                    "text": "investeering "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 208.58,
                                "end": 209.27
                            }
                        }
                    ],
                    "text": "tulevikku, "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 209.45,
                                "end": 209.81
                            }
                        }
                    ],
                    "text": "kust "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 209.84,
                                "end": 210.08
                            }
                        }
                    ],
                    "text": "raha "
                },
                {
                    "type": "text",
                    "marks": [
                        {
                            "type": "word",
                            "attrs": {
                                "start": 210.08,
                                "end": 210.59
                            }
                        }
                    ],
                    "text": "võetakse?"
                }
            ]
        }
    ]
} 
const nameExists = (names: Array<Speaker>, name: string) => names.find(n => n.name === name);
content.content.forEach((node) => {
    let id;
    if (!nameExists(speakers, node.attrs['data-name'])) {
        id = uuidv4().substring(36 - 12);
    } else {
        id = nameExists(speakers, node.attrs['data-name']).id;
    }
    node.attrs.id = id;
    const start =
        node.content && node.content[0] && node.content[0].marks && node.content[0].marks[0].attrs.start
            ? node.content[0].marks[0].attrs.start
            : -1;
    const end =
        node.content && node.content[node.content.length-1] && node.content[node.content.length-1].marks && node.content[node.content.length-1].marks[0].attrs.end
            ? node.content[node.content.length-1].marks[0].attrs.end
            : -1;
    speakers.push({ name: node.attrs['data-name'], id: node.attrs.id, start, end });
    if (node.content) {
        node.content.forEach((inlineNode) => {
            if (inlineNode.type === 'text' && inlineNode.marks.length > 0) {
                inlineNode.marks.forEach((mark) => {
                    if (mark.type == 'word') {
                        const id = uuidv4().substring(36 - 12);
                        mark.attrs.id = id;
                        words.push({ start: mark.attrs.start, end: mark.attrs.end, id: mark.attrs.id });
                    }
                });
            }
        });
    }
});