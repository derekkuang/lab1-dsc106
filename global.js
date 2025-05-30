console.log("IT'S ALIVE!");


// color switch
document.body.insertAdjacentHTML(
  'afterbegin',
  `
	<label class="color-scheme">
		Theme:
		<select>
			<option value="light dark">Automatic</option>
      <option value="light">Light</option>
      <option value="dark">Dark</option>
		</select>
	</label>`,
);


function $$(selector, context = document) {
  return Array.from(context.querySelectorAll(selector));
}

// saving user preference


// Base path
const BASE_PATH = (location.hostname === "localhost" || location.hostname === "127.0.0.1")
  ? "/profolio/"                  // Local server
  : "/profolio-dsc106/";         // GitHub Pages repo name

// Nav Bar 
let pages = [
  { url: "", title: "Home" },
  { url: "contact/", title: "Contact" },
  { url: "projects/", title: "Projects" },
  { url: "resume/", title: "Resume" },
  { url: "meta/", title: "Meta Analysis" },
  { url: "https://github.com/derekkuang", title: "Github Profile" },
];

let nav = document.createElement("nav");
document.body.prepend(nav);

for (let p of pages) {
  let url = p.url;
  let title = p.title;

  url = !url.startsWith('http') ? BASE_PATH + url : url;
  
  let a = document.createElement('a');
  a.href = url;
  a.textContent = title;
  nav.append(a);

  a.classList.toggle(
    'current',
    a.host === location.host && a.pathname === location.pathname,
  );

  if (a.host !== location.host) {
    a.target = '_blank';
    a.rel    = 'noopener noreferrer';
  }

}

const select = document.querySelector('.color-scheme select');

select.addEventListener('input', function (event) {
  console.log('color scheme changed to', event.target.value);
  document.documentElement.style.setProperty('color-scheme', event.target.value);
  localStorage.colorScheme = event.target.value
});

const saved = localStorage.colorScheme;
if (saved) {
  document.documentElement.style.setProperty('color-scheme', localStorage.colorScheme);
  select.value = localStorage.colorScheme;
} else {
  document.documentElement.style.setProperty('color-scheme', select.value);
}

select.addEventListener('input', (e) => {
  const scheme = e.target.value;
  document.documentElement.style.setProperty('color-scheme', scheme);
  localStorage.colorScheme = scheme;
  console.log('Saved color scheme:', scheme);
});

export async function fetchJSON(url) {
  try {
    // Fetch the JSON file from the given URL
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch projects: ${response.statusText}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching or parsing JSON data:', error);
  }
}

export function renderProjects(project, containerElement, headingLevel = 'h2') {
	containerElement.innerHTML = '';
  
	project.forEach(proj => {
	  // Fix image path based on current page location
	  let imagePath = proj.image;
	  
	  // If we're on the home page and path starts with "../images/"
	  if (!window.location.pathname.includes('/projects/') && 
	      imagePath.startsWith('../images/')) {
	    // Convert "../images/" to "./images/" for home page
	    imagePath = imagePath.replace('../images/', './images/');
	  }
	  
	  const article = document.createElement('article');
	  
	  // Create title element with optional link
	  let titleHTML = `<${headingLevel}>${proj.title}</${headingLevel}>`;
	  if (proj.url) {
	    titleHTML = `<${headingLevel}><a href="${proj.url}" target="_blank">${proj.title}</a></${headingLevel}>`;
	  }
	  
	  article.innerHTML = `
		${titleHTML}
		<img src="${imagePath}" alt="${proj.title}">
		<div class="project-desc-year">
			<p>${proj.description}</p>
			<div class="project-year">${proj.year}</div>
		</div>
	  `;
	  containerElement.appendChild(article);
	});
  }

export async function fetchGitHubData(username) {
  return fetchJSON(`https://api.github.com/users/${username}`);
}
