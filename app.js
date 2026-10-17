const guide = document.querySelector('#guide');
const tocList = document.querySelector('#tocList');
const searchInput = document.querySelector('#searchInput');
const searchStatus = document.querySelector('#searchStatus');
const sidebar = document.querySelector('#sidebar');
const scrim = document.querySelector('#scrim');
const menuButton = document.querySelector('#menuButton');
const progressBar = document.querySelector('#progressBar');
const backTop = document.querySelector('#backTop');

const escapeHtml = value => value
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

const slugify = (text, index) => {
  const clean = text.replace(/[\s、，。！？：；“”‘’（）()《》\/\\]+/g, '-').replace(/^-|-$/g, '');
  return `${clean || 'section'}-${index}`;
};

function inline(text) {
  let out = escapeHtml(text);
  out = out.replace(/!\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, file, size) => {
    const width = size && /^\d+$/.test(size) ? ` style="width:${size}px"` : '';
    return `<img class="content-image" src="assets/${encodeURI(file)}" alt="文中示例图片" loading="lazy"${width}>`;
  });
  out = out.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img class="content-image" src="$2" alt="$1" loading="lazy">');
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) => {
    const safeHref = /^(https?:\/\/|#|mailto:)/i.test(href) ? href : `https://${href}`;
    const external = /^(https?:\/\/|mailto:)/i.test(safeHref);
    return `<a href="${safeHref}"${external ? ' target="_blank" rel="noopener"' : ''}>${label}</a>`;
  });
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
  return out;
}

function renderMarkdown(markdown) {
  const lines = markdown.replace(/\r/g, '').split('\n');
  const html = [];
  let paragraph = [];
  let list = null;
  let code = null;
  let headingIndex = 0;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    html.push(`<p>${inline(paragraph.join(' '))}</p>`);
    paragraph = [];
  };
  const flushList = () => {
    if (!list) return;
    html.push(`<${list.type}>${list.items.map(item => `<li>${inline(item)}</li>`).join('')}</${list.type}>`);
    list = null;
  };

  for (const line of lines) {
    if (code !== null) {
      if (/^```/.test(line)) {
        html.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`);
        code = null;
      } else code.push(line);
      continue;
    }
    if (/^```/.test(line)) { flushParagraph(); flushList(); code = []; continue; }
    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      flushParagraph(); flushList();
      const level = heading[1].length;
      const title = heading[2].trim();
      const id = slugify(title, ++headingIndex);
      html.push(`<h${level} id="${id}">${inline(title)}</h${level}>`);
      continue;
    }
    const ul = line.match(/^\s*[-*]\s+(.+)$/);
    const ol = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (ul || ol) {
      flushParagraph();
      const type = ol ? 'ol' : 'ul';
      if (list && list.type !== type) flushList();
      if (!list) list = { type, items: [] };
      list.items.push((ul || ol)[1]);
      continue;
    }
    if (/^>\s?/.test(line)) {
      flushParagraph(); flushList();
      html.push(`<blockquote>${inline(line.replace(/^>\s?/, ''))}</blockquote>`);
      continue;
    }
    if (/^\s*---+\s*$/.test(line)) { flushParagraph(); flushList(); html.push('<hr>'); continue; }
    if (!line.trim()) { flushParagraph(); flushList(); continue; }
    paragraph.push(line.trim());
  }
  flushParagraph(); flushList();
  if (code !== null) html.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`);
  return html.join('\n');
}

function buildToc() {
  const headings = [...guide.querySelectorAll('h1,h2,h3')].filter(h => /^(?:\d+(?:\.\d+)*[.、]?\s*|结语|WorkBuddy)/.test(h.textContent.trim()));
  tocList.innerHTML = headings.map(h => {
    const numeric = h.textContent.trim().match(/^\d+(?:\.\d+)*/)?.[0] || '';
    const sub = numeric.includes('.') && !/^\d+\.$/.test(numeric) ? ' sub' : (h.tagName === 'H3' ? ' sub' : '');
    return `<a class="${sub.trim()}" href="#${h.id}">${h.textContent}</a>`;
  }).join('');
  tocList.querySelectorAll('a').forEach(a => a.addEventListener('click', closeMenu));

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      tocList.querySelectorAll('a').forEach(a => a.classList.toggle('active', a.hash === `#${entry.target.id}`));
    });
  }, { rootMargin: '-15% 0px -75%' });
  headings.forEach(h => observer.observe(h));
}

function clearMarks() {
  guide.querySelectorAll('mark').forEach(mark => mark.replaceWith(document.createTextNode(mark.textContent)));
  guide.normalize();
}

function searchGuide(query) {
  clearMarks();
  const q = query.trim();
  if (!q) { searchStatus.textContent = ''; return; }
  let count = 0;
  const walker = document.createTreeWalker(guide, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.nodeValue.trim() || ['SCRIPT', 'STYLE', 'CODE'].includes(node.parentElement?.tagName)) return NodeFilter.FILTER_REJECT;
      return node.nodeValue.toLowerCase().includes(q.toLowerCase()) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    }
  });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach(node => {
    const text = node.nodeValue;
    const lower = text.toLowerCase();
    const queryLower = q.toLowerCase();
    const frag = document.createDocumentFragment();
    let start = 0, index;
    while ((index = lower.indexOf(queryLower, start)) !== -1) {
      frag.append(text.slice(start, index));
      const mark = document.createElement('mark');
      mark.textContent = text.slice(index, index + q.length);
      frag.append(mark);
      start = index + q.length;
      count++;
    }
    frag.append(text.slice(start));
    node.replaceWith(frag);
  });
  searchStatus.textContent = count ? `找到 ${count} 处相关内容` : '未找到相关内容';
  guide.querySelector('mark')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function closeMenu() {
  sidebar.classList.remove('open'); scrim.classList.remove('show');
  menuButton.setAttribute('aria-expanded', 'false');
}

async function loadGuide() {
  try {
    let markdown = window.GUIDE_MARKDOWN;
    if (!markdown) {
      const response = await fetch('guide.md');
      if (!response.ok) throw new Error('load failed');
      markdown = await response.text();
    }
    guide.innerHTML = renderMarkdown(markdown);
    guide.querySelectorAll('h1,h2,h3').forEach(heading => {
      const title = heading.textContent.trim();
      if (title === 'WorkBuddy / AI Agent 新手完全指南') heading.id = 'workbuddy-agent-guide';
      if (title === 'WorkBuddy Skills 使用指南') heading.id = 'workbuddy-skills-guide';
    });
    const chars = markdown.replace(/\s/g, '').length;
    document.querySelector('#readTime').textContent = `约 ${Math.max(6, Math.round(chars / 450))} 分钟阅读`;
    buildToc();
  } catch {
    guide.innerHTML = '<h2>指南暂时无法载入</h2><p>请通过网站地址访问本页面，或确认 <code>guide.md</code> 与网页文件位于同一目录。</p>';
  }
}

searchInput.addEventListener('input', event => searchGuide(event.target.value));
document.addEventListener('keydown', event => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault(); searchInput.focus(); searchInput.select();
  }
  if (event.key === 'Escape') { searchInput.value = ''; searchGuide(''); closeMenu(); }
});

menuButton.addEventListener('click', () => {
  const open = sidebar.classList.toggle('open'); scrim.classList.toggle('show', open);
  menuButton.setAttribute('aria-expanded', String(open));
});
scrim.addEventListener('click', closeMenu);
document.querySelector('#printButton').addEventListener('click', () => window.print());
document.querySelector('#themeButton').addEventListener('click', () => {
  const dark = document.body.classList.toggle('dark');
  localStorage.setItem('guide-theme', dark ? 'dark' : 'light');
  document.querySelector('#themeIcon').textContent = dark ? '☀' : '◐';
});
if (localStorage.getItem('guide-theme') === 'dark') {
  document.body.classList.add('dark'); document.querySelector('#themeIcon').textContent = '☀';
}

window.addEventListener('scroll', () => {
  const total = document.documentElement.scrollHeight - innerHeight;
  progressBar.style.width = `${total > 0 ? (scrollY / total) * 100 : 0}%`;
  backTop.classList.toggle('show', scrollY > 650);
}, { passive: true });
backTop.addEventListener('click', () => scrollTo({ top: 0, behavior: 'smooth' }));

loadGuide();
