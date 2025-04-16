// global.js

document.addEventListener("DOMContentLoaded", () => {
  console.log("IT’S ALIVE!");

  // 1) Detect whether we’re local or on GitHub Pages
  const BASE_PATH = 
    ["localhost", "127.0.0.1"].includes(location.hostname)
      ? "/"
      : "/portfolio-106/";  // ← change to your repo name

  // 2) Your site pages (always point to actual files)
  const pages = [
    { url: "index.html",          title: "Home"           },
    { url: "projects/index.html", title: "Projects"       },
    { url: "contact/index.html",  title: "Contact"        },
    { url: "resume/index.html",   title: "Resume"         },
    { url: "https://github.com/derekkuang", title: "GitHub" }
  ];

  // 3) Build the <nav>
  const nav = document.createElement("nav");

  pages.forEach(({ url, title }) => {
    // 3a) Compute href
    const href = url.startsWith("http") 
      ? url 
      : BASE_PATH + url;

    // 3b) Create link
    const a = document.createElement("a");
    a.href = href;
    a.textContent = title;

    // 3c) Highlight current page (only for internal links)
    if (!url.startsWith("http") && new URL(href, location.origin).pathname === location.pathname) {
      a.classList.add("current");
    }

    // 3d) External links open in new tab
    if (url.startsWith("http")) {
      a.target = "_blank";
      a.rel    = "noopener noreferrer";
    }

    nav.appendChild(a);
  });

  // 4) Insert nav at the top of the body
  document.body.insertBefore(nav, document.body.firstChild);
});
