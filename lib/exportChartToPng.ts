import html2canvas from "html2canvas";

export async function exportDivToPng(el: HTMLElement, filename: string) {
  const canvas = await html2canvas(el, {
    backgroundColor: "#ffffff",
    scale: 2,
    useCORS: true,
    logging: false,
  });
  const a = document.createElement("a");
  a.href = canvas.toDataURL("image/png");
  a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.png`;
  a.click();
}
