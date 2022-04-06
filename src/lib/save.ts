export const saveChanges = async (text, fileId) => {
    const res = await fetch(
      // (process.env.NODE_ENV === "development" ? endpoint : prodEndpoint) +
        `/transcript?id=${fileId}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(text)
      }
    )
      .then(res => {
        toaster.success("Salvestatud!", {
          duration: 2,
          id: "saved-toast"
        });
      })
      .catch(e => {
        toaster.danger(
          "Viga automaatsel salvestamisel! Kontrolli internetiühendust.",
          {
            duration: 120,
            id: "saved-toast"
          }
        );
      });
  };

export const debouncedSave = debounce(this.saveChanges, 15000, {
    leading: false,
    trailing: true
});