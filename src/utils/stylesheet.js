export function loadStylesheet(href) {
  return new Promise((resolve) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.addEventListener("load", resolve);
    link.addEventListener("error", resolve);
    document.head.append(link);
  });
}
