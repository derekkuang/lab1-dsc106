console.log("IT’S ALIVE!");

function $$(selector, context = document) {
  return Array.from(context.querySelectorAll(selector));
}

const BASE_PATH = (location.hostname === "localhost" || location.hostname === "127.0.0.1")
  ? "/profolio/"                  // Local server
  : "/profolio-dsc106/";         // GitHub Pages repo name

let pages = [
  { url: "", title: "Home" },
  { url: "contact/", title: "Contact" },
  { url: "projects/", title: "Projects" },
  { url: "resume/", title: "Resume" },
  { url: "https://github.com/derekkuang", title: "Github Profile" },
];

let nav = document.createElement("nav");
document.body.prepend(nav);

for (let p of pages) {
  let url = p.url;
  let title = p.title;
  url = !url.startsWith('http') ? BASE_PATH + url : url;
  nav.insertAdjacentHTML('beforeend', `<a href="${url}">${title}</a>`);
}


