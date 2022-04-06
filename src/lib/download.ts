import { Document, Packer, Paragraph, TextRun, SectionType } from "docx";

export const downloadHandler = (content, author, title) => {
    const doc = new Document({
        creator: "Dolan Miu",
        description: "My extremely interesting document",
        title: "My Document",
        sections: [{
            properties: {
                type: SectionType.CONTINUOUS,
            },
            children: [
                new Paragraph({
                    children: [new TextRun("Hello World")],
                }),
            ],
        }]
    });

    Packer.toBlob(doc).then((blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "transkriptsioon.docx";
        document.body.appendChild(a); // we need to append the element to the dom -> otherwise it will not work in firefox
        console.log(a);
        a.click();
        a.remove(); //afterwards we remove the element again
    });

    /* const res = fetch(
      // (process.env.NODE_ENV === "development" ? endpoint : prodEndpoint) +
        `/download`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(content)
      }
    )
      .then(response => {
        return response.blob();
      })
      .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "transkriptsioon.docx";
        document.body.appendChild(a); // we need to append the element to the dom -> otherwise it will not work in firefox
        console.log(a);
        a.click();
        a.remove(); //afterwards we remove the element again
      })
      .catch(e => console.log(e)); */
  };