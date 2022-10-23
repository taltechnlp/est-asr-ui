export type TranscriptionContent = {
    type: string;
    content?: {
        type: string;
        attrs: {
            "data-name": string;
            id: string;
        };
        content?: {
            type: string;
            marks?: {
                type: string;
                attrs: {
                    start: number;
                    end: number;
                    id: string;
                }
            }[],
            text: string;
        }[]
    }[]
}

const example: TranscriptionContent = {
  "type": "doc",
  "content": [
    {
      "type": "speaker",
      "attrs": {
        "data-name": null,
        "id": "570-689acf5120ad"
      },
      "content": [
        {
          "type": "text",
          "marks": [
            {
              "type": "word",
              "attrs": {
                "start": 18.81,
                "end": 19.5,
                "id": "125-47701872c5b0"
              }
            }
          ],
          "text": " "
        },
        {
          "type": "text",
          "marks": [
            {
              "type": "word",
              "attrs": {
                "start": 19.5,
                "end": 19.71,
                "id": "125-47701872c5b0"
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
                "start": 19.71,
                "end": 20.28,
                "id": "125-47701872c5b0"
              }
            }
          ],
          "text": "tehnilise"
        }
      ]
    },
    {
      "type": "speaker",
      "attrs": {
        "data-name": null,
        "id": "570-689acf5120ad"
      },
      "content": [
        {
          "type": "text",
          "marks": [
            {
              "type": "word",
              "attrs": {
                "start": 19.71,
                "end": 20.28,
                "id": "125-47701872c5b0"
              }
            }
          ],
          "text": " "
        },
        {
          "type": "text",
          "marks": [
            {
              "type": "word",
              "attrs": {
                "start": 20.31,
                "end": 21.18,
                "id": "125-47701872c5b0"
              }
            }
          ],
          "text": "järelevalve "
        },
        {
          "type": "text",
          "marks": [
            {
              "type": "word",
              "attrs": {
                "start": 21.18,
                "end": 21.48,
                "id": "125-47701872c5b0"
              }
            }
          ],
          "text": "loodasb, "
        },
        {
          "type": "text",
          "marks": [
            {
              "type": "word",
              "attrs": {
                "start": 21.6,
                "end": 21.9,
                "id": "125-47701872c5b0"
              }
            }
          ],
          "text": " "
        }
      ]
    },
    {
      "type": "speaker",
      "attrs": {
        "data-name": null,
        "id": "570-689acf5120ad"
      },
      "content": [
        {
          "type": "text",
          "marks": [
            {
              "type": "word",
              "attrs": {
                "start": 21.9,
                "end": 22.41,
                "id": "125-47701872c5b0"
              }
            }
          ],
          "text": "sadamasse "
        },
        {
          "type": "text",
          "marks": [
            {
              "type": "word",
              "attrs": {
                "start": 22.41,
                "end": 22.68,
                "id": "125-47701872c5b0"
              }
            }
          ],
          "text": "kinni "
        },
        {
          "type": "text",
          "marks": [
            {
              "type": "word",
              "attrs": {
                "start": 22.68,
                "end": 23.01,
                "id": "125-47701872c5b0"
              }
            }
          ],
          "text": "jäänud "
        },
        {
          "type": "text",
          "marks": [
            {
              "type": "word",
              "attrs": {
                "start": 23.04,
                "end": 23.79,
                "id": "125-47701872c5b0"
              }
            }
          ],
          "text": "12000 "
        }
      ]
    },
    {
      "type": "speaker",
      "attrs": {
        "data-name": "Janek Salme",
        "id": null
      }
    },
    {
      "type": "speaker",
      "attrs": {
        "data-name": "Janek Salme",
        "id": null
      }
    },
    {
      "type": "speaker",
      "attrs": {
        "data-name": "Janek Salme",
        "id": "570-689acf5120ad"
      },
      "content": [
        {
          "type": "text",
          "marks": [
            {
              "type": "word",
              "attrs": {
                "start": 23.79,
                "end": 24.06,
                "id": "125-47701872c5b0"
              }
            }
          ],
          "text": "tonni "
        },
        {
          "type": "text",
          "marks": [
            {
              "type": "word",
              "attrs": {
                "start": 24.06,
                "end": 24.48,
                "id": "125-47701872c5b0"
              }
            }
          ],
          "text": "väetist "
        },
        {
          "type": "text",
          "marks": [
            {
              "type": "word",
              "attrs": {
                "start": 24.48,
                "end": 24.81,
                "id": "125-47701872c5b0"
              }
            }
          ],
          "text": "viiakse "
        },
        {
          "type": "text",
          "marks": [
            {
              "type": "word",
              "attrs": {
                "start": 24.81,
                "end": 25.11,
                "id": "125-47701872c5b0"
              }
            }
          ],
          "text": "sealt "
        }
      ]
    }
  ]
} 