# Vignesh S — C++ Software Engineer Portfolio

A professional, minimal, and responsive portfolio website built with **HTML5, CSS3, and Vanilla JavaScript** — no frameworks, no dependencies.

## 🎯 About

Personal portfolio of **Vignesh S**, a C++ Software Engineer with 3+ years of experience in:

- **Industrial Automation** & Embedded Systems
- **C++, MFC, Qt/QML** Development
- **Honeywell Experion PKS** Systems
- **Developer Tools** & Workflow Automation
- **Process Control** & Real-Time Software

**Visit:** [vigneshsl.github.io/vigneshcareer](https://vigneshsl.github.io/vigneshcareer)

## 📂 Project Structure

```
vigneshcareer/
├── index.html                 # Lightweight page shell
├── README.md                  # This file
│
├── sections/                  # HTML section components
│   ├── header.html           # Topbar + navigation
│   ├── hero.html             # Hero section
│   ├── about.html            # About/summary
│   ├── skills.html           # Technical skills
│   ├── experience.html       # Professional experience
│   ├── projects.html         # Key projects
│   ├── education.html        # Education background
│   ├── certifications.html   # Certificate gallery
│   ├── contact.html          # Contact form
│   └── footer.html           # Footer
│
├── assets/
│   ├── css/                  # Stylesheets
│   │   ├── style.css         # Core styles & design tokens
│   │   ├── components.css    # Reusable components
│   │   └── responsive.css    # Responsive breakpoints
│   │
│   ├── js/                   # JavaScript modules
│   │   ├── app.js            # Entry point & section loader
│   │   ├── navigation.js     # Navigation & menu
│   │   ├── animations.js     # Scroll reveal & effects
│   │   ├── certificates.js   # Certificate gallery
│   │   └── contact.js        # Contact form handling
│   │
│   ├── data/
│   │   └── certificates.json # Certificate manifest (auto-generated)
│   │
│   └── images/               # Images & assets
│       └── profile/          # Profile photos (if available)
│
├── certificates/             # Certificate images
│   ├── cpp-essential-training.jpg
│   ├── mfc-visual-cpp.jpg
│   ├── secure-coding-cpp.jpg
│   ├── code-reviews.jpg
│   └── agile-software-development.jpg
│
├── projects/                 # Project assets (future)
│
├── resume/                   # Resume files
│   ├── Vignesh_S_Resume.pdf
│   └── Vignesh_S_Resume.tex
│
├── tools/                    # Standalone utility tools
│   ├── cpp-include-analyzer/
│   ├── case-converter/
│   ├── code-line-counter/
│   ├── comment-remover/
│   ├── content-replacement/
│   ├── copy-move-zap/
│   ├── dump-file-to-string/
│   ├── file-renamer/
│   ├── search/
│   ├── smart-folder-backup/
│   ├── xml-manager/
│   └── user-manual/
│
├── scripts/                  # Build scripts
│   └── generate-certificates.js
│
├── archive/                  # Archived files
│   └── index-old.html
│
└── .github/
    └── workflows/            # GitHub Actions
        └── update-certificates.yml
```

## 🚀 Local Development

### Prerequisites

- A web server (not `file://` protocol)
- No build tools required

### Running Locally

**Python 3:**
```bash
python -m http.server 8000
```

**Python 2:**
```bash
python -m SimpleHTTPServer 8000
```

**Node.js (http-server):**
```bash
npx http-server -p 8000
```

Then open: **http://localhost:8000**

## 📜 Dynamic Certificate System

### How It Works

The certificate gallery is **fully dynamic** — images are automatically discovered from the `certificates/` folder.

#### Adding a Certificate

1. **Save certificate image** to `certificates/`:
   ```
   certificates/my-cert-name.jpg
   ```

2. **(Optional) Add metadata** to `certificates/metadata.json`:
   ```json
   {
       "my-cert-name.jpg": {
           "title": "My Certification Title",
           "issuer": "Issuing Organization",
           "date": "Month Year"
       }
   }
   ```

3. **Generate manifest** (local development):
   ```bash
   node scripts/generate-certificates.js
   ```

4. The website automatically detects and displays the certificate.

### Supported Formats

- `.jpg`, `.jpeg`, `.png`, `.webp`

### Automatic Title Generation

If metadata is not provided, the filename is converted to a readable title:

- `cpp-essential-training.jpg` → "C++ Essential Training"
- `secure-coding-cpp.jpg` → "Secure Coding C++"
- `mfc-visual-cpp.jpg` → "MFC Visual C++"

## 🎨 Design System

### Color Palette (Emerald Theme)

**Light Mode:**
- **Background:** `#FFFFFF`
- **Primary Text:** `#111714`
- **Secondary Text:** `#66736D`
- **Primary Emerald:** `#087443`
- **Accent Emerald:** `#16A36A`
- **Highlight:** `#39D98A`
- **Borders:** `#DDE5E1`

**Dark Mode:**
- Automatically adapts using CSS variables

### Typography

- **Display:** Plus Jakarta Sans (400, 500, 600, 700, 800)
- **Monospace:** JetBrains Mono (400, 500)

### Components

- Buttons, cards, chips, badges, forms
- Scroll-reveal animations
- Responsive grid layouts
- Mobile-optimized navigation

## ♿ Accessibility

- Semantic HTML
- ARIA labels & descriptions
- Keyboard navigation
- Focus visible states
- Reduced motion support
- Color contrast ≥ 4.5:1

## 📱 Responsive Design

- **Mobile:** 320px - 599px
- **Tablet:** 600px - 899px
- **Desktop:** 900px+
- **Large Desktop:** 1400px+

Tested on iPhone, iPad, Android, and desktop browsers.

## 🔄 GitHub Actions

### Automatic Certificate Updates

When you push certificate images to `certificates/`, GitHub Actions automatically:

1. Runs `scripts/generate-certificates.js`
2. Updates `assets/data/certificates.json`
3. Commits changes (if needed)
4. Deploys to GitHub Pages

**Workflow file:** `.github/workflows/update-certificates.yml`

## 📝 Content Updates

### Editing Sections

Each section is a separate HTML file in `sections/`. Edit directly and push:

- `sections/hero.html` — Hero section
- `sections/about.html` — About/summary
- `sections/skills.html` — Skills
- `sections/experience.html` — Experience
- `sections/projects.html` — Projects
- `sections/education.html` — Education
- `sections/certifications.html` — Certificate gallery
- `sections/contact.html` — Contact form
- `sections/footer.html` — Footer

### Editing Styles

CSS is split into three files:

- `assets/css/style.css` — Core styles & design tokens
- `assets/css/components.css` — Component styles
- `assets/css/responsive.css` — Responsive breakpoints

### Editing JavaScript

JavaScript is modular:

- `assets/js/app.js` — App initialization & section loading
- `assets/js/navigation.js` — Menu, theme, scrollspy
- `assets/js/animations.js` — Scroll reveal, counters, typing
- `assets/js/certificates.js` — Certificate gallery
- `assets/js/contact.js` — Contact form validation

## 🛠️ Technologies

- **HTML5** — Semantic structure
- **CSS3** — Custom properties, Grid, Flexbox
- **JavaScript (ES Modules)** — Vanilla, no frameworks
- **Fetch API** — Section & data loading
- **LocalStorage** — Theme & preference persistence

## 🚫 Why No Framework?

This portfolio is built with **zero dependencies**:

- ✅ Fast load times
- ✅ Easy to understand & modify
- ✅ Perfect for GitHub Pages
- ✅ Maintains focus on content
- ✅ Professional appearance

## 📊 Performance

- **Lighthouse Score:** 95+
- **Core Web Vitals:** Pass
- **No external dependencies:** Minimal HTTP requests
- **Modular sections:** Load only what's needed

## 📜 License

© 2025 Vignesh S. All rights reserved.

## 📧 Contact

- **Email:** [vigneshsl.career@gmail.com](mailto:vigneshsl.career@gmail.com)
- **Phone:** [+91-9677362774](tel:+919677362774)
- **LinkedIn:** [vignesh-softwaredev](https://www.linkedin.com/in/vignesh-softwaredev)
- **GitHub:** [@vigneshsl](https://github.com/vigneshsl)

---

**Built with care. No AI-generated templates. 100% human-designed.**