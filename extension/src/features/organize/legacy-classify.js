/**
 * Built-in categorization rules (ported from organize_bookmarks.py).
 * Returns { top, sub } where sub may be null.
 */
function textBlob(url, title) {
    return `${url} ${title}`.toLowerCase();
  }

  function isShortlink(url) {
    const u = url.toLowerCase();
    return ["bit.ly/", "tinyurl.com/", "t.co/", "goo.gl/", "ow.ly/", "is.gd/", "buff.ly/"].some(
      (x) => u.includes(x)
    );
  }

  function isYoutube(url) {
    const u = url.toLowerCase();
    return u.includes("youtube.com") || u.includes("youtu.be");
  }

  function isGithub(url) {
    return url.toLowerCase().includes("github.com");
  }

  function parseHostPath(url) {
    try {
      const p = new URL(url);
      let host = (p.hostname || "").toLowerCase();
      if (host.startsWith("www.")) host = host.slice(4);
      return { host, pathL: (p.pathname || "/").toLowerCase(), u: url.toLowerCase() };
    } catch {
      return { host: "", pathL: "/", u: (url || "").toLowerCase() };
    }
  }

export function legacyClassify(url, title) {
    const t = textBlob(url, title);
    const { host, pathL, u } = parseHostPath(url);

    if (isShortlink(url)) return { top: "Archive", sub: "Short Links" };
    if (
      isYoutube(url) &&
      ["live", "stream", "watch?v=", "كورة", "kooora", "football", "cricket"].some((x) => t.includes(x))
    )
      return { top: "Archive", sub: "Streams & Ephemeral" };
    if (["kooora", "crichd", "stream"].some((x) => host.includes(x)) || title.includes("كورة"))
      return { top: "Archive", sub: "Streams & Ephemeral" };
    if (host.includes("blogspot.com") && t.includes("dong"))
      return { top: "Archive", sub: "Random Links" };
    if (host.includes("facebook.com") || host.includes("touch.facebook"))
      return { top: "Archive", sub: "Social & Leisure" };
    if (host.endsWith(".onion")) return { top: "Archive", sub: "Legacy Onion Links" };

    if (
      [
        "eff.org",
        "ssd.eff.org",
        "emailselfdefense.fsf.org",
        "torproject.org",
        "tails.boum.org",
        "whonix.org",
        "qubes-os.org",
        "gnupg.org",
        "crypt.parrot.sh",
      ].some((x) => host.includes(x))
    )
      return { top: "Security", sub: "Privacy & Advocacy" };

    if (
      [
        "linkedin",
        "indeed",
        "glassdoor",
        "angel.co",
        "wellfound",
        "lever.co",
        "greenhouse.io",
        "jobs.",
        "careers.",
        "resume",
        "interview",
      ].some((x) => t.includes(x))
    )
      return { top: "Career & Jobs", sub: null };

    if (
      [
        "figma.com",
        "dribbble.com",
        "behance.net",
        "canva.com",
        "coolors.co",
        "fonts.google",
        "fontspace",
        "stitch.withgoogle.com",
      ].some((x) => host.includes(x)) ||
      ["typography", "color palette", "ui/ux", "wireframe"].some((x) => t.includes(x))
    )
      return { top: "Design", sub: null };

    if (
      [
        "khan academy",
        "mathworld",
        "wolfram",
        "art of problem solving",
        "3blue1brown",
        "calculus",
        "linear algebra",
        "probability",
        "statistics theory",
        "proof",
        "mathematica",
      ].some((x) => t.includes(x)) ||
      ["wolfram.com", "mathoverflow.net", "artofproblemsolving.com"].some((x) => host.includes(x))
    )
      return { top: "Mathematics", sub: null };

    if (
      [
        "arxiv.org",
        "scholar.google",
        "semanticscholar.org",
        "ieee.org",
        "acm.org",
        "jstor.org",
        "researchgate.net",
        "sciencedirect.com",
        "springer.com",
        "nature.com",
        "science.org",
        "pnas.org",
        "plos.org",
        "pubmed",
        "ncbi.nlm.nih.gov",
        "doi.org",
        "patents.google.com",
      ].some((x) => host.includes(x)) ||
      ["peer-reviewed", "paper:", "proceedings"].some((x) => t.includes(x))
    )
      return { top: "Research", sub: null };

    if (
      [
        "machine learning",
        "deep learning",
        "neural network",
        "pytorch",
        "tensorflow",
        "keras",
        "huggingface",
        "hugging face",
        "openai",
        "anthropic",
        "llm",
        "langchain",
        "prompt engineering",
        "colab",
        "fast.ai",
        "paperswithcode",
        "arxiv:cs.lg",
        "arxiv:cs.ai",
        "arxiv:stat.ml",
        "scikit-learn",
        "sklearn",
        "nlp ",
        "computer vision",
        "yolo",
        "stable diffusion",
        "midjourney",
        "replicate.com",
      ].some((x) => t.includes(x)) ||
      [
        "openai.com",
        "chatgpt.com",
        "anthropic.com",
        "huggingface.co",
        "kaggle.com",
        "paperswithcode.com",
        "distill.pub",
        "weights.gg",
      ].some((x) => host.includes(x))
    ) {
      if (host.includes("kaggle.com") && ["competition", "kernel"].some((x) => t.includes(x)))
        return { top: "Data Science", sub: "Kaggle & Practice" };
      if (host.includes("kaggle.com")) return { top: "Data Science", sub: null };
      return { top: "AI & Machine Learning", sub: null };
    }

    if (
      [
        "pandas",
        "numpy",
        "jupyter",
        "dataframe",
        "etl",
        "data warehouse",
        "snowflake",
        "databricks",
        "tableau",
        "power bi",
        "looker",
        "dbt ",
      ].some((x) => t.includes(x)) ||
      ["mode.com", "hex.tech", "datasette"].some((x) => host.includes(x))
    )
      return { top: "Data Science", sub: null };

    if (
      [
        "hackthebox",
        "tryhackme",
        "owasp",
        "exploit-db",
        "portswigger",
        "hackerone",
        "bugcrowd",
        "cve.mitre",
        "nist.gov",
        "sans.org",
      ].some((x) => host.includes(x)) ||
      ["pentest", "penetration test", "ctf", "burp suite"].some((x) => t.includes(x))
    ) {
      if (["course", "learn", "tutorial", "guide", "introduction"].some((x) => t.includes(x)))
        return { top: "Security", sub: "Reference & Learning" };
      return { top: "Security", sub: "Tools & Labs" };
    }

    if (
      [
        "ubuntu.com",
        "debian.org",
        "mxlinux.org",
        "manjaro.org",
        "antixlinux.com",
        "parrotsec.org",
        "archlinux.org",
        "fedoraproject.org",
        "kernel.org",
        "docs.parrot.sh",
        "mirror.parrot.sh",
        "antixforum.com",
      ].some((x) => host.includes(x)) ||
      ["linux distro", "bootloader", "xda-developers"].some((x) => t.includes(x))
    )
      return { top: "Linux & Systems", sub: null };

    if (host.includes("answers.launchpad.net")) return { top: "Linux & Systems", sub: null };
    if (host.includes("isecom.org")) return { top: "Security", sub: "Reference & Learning" };

    if (
      [
        "notion.so",
        "todoist.com",
        "trello.com",
        "asana.com",
        "calendar.google",
        "keep.google",
        "drive.google.com",
        "dropbox.com",
        "evernote.com",
        "obsidian.md",
      ].some((x) => host.includes(x)) ||
      ["google keep", "productivity", "pomodoro", "ergonomic", "office color"].some((x) => t.includes(x))
    )
      return { top: "Productivity", sub: null };

    const webDevHost = [
      "developer.mozilla.org",
      "w3schools.com",
      "nodejs.org",
      "npmjs.com",
      "reactjs.org",
      "vuejs.org",
      "angular.io",
      "nextjs.org",
      "webpack.js.org",
      "tailwindcss.com",
      "stackoverflow.com",
      "stackexchange.com",
      "css-tricks.com",
      "web.dev",
      "php.net",
      "learn.wordpress.org",
      "wordpress.org",
    ].some((x) => host.includes(x));
    const webDevText = [
      "html",
      "css",
      "javascript",
      "typescript",
      "react",
      "vue",
      "angular",
      "node.js",
      "frontend",
      "backend",
      "rest api",
      "graphql",
    ].some((x) => t.includes(x));
    if (webDevHost || webDevText) {
      if (["npmjs.com", "webpack", "vite.dev", "parceljs.org"].some((x) => host.includes(x)))
        return { top: "Web Development", sub: "Tools" };
      return { top: "Web Development", sub: "Reference & Learning" };
    }

    if (isGithub(url)) {
      if (["security", "pentest", "awesome-security", "awesome-pentest", "exploit", "cve"].some((x) => t.includes(x)))
        return { top: "Security", sub: "Repositories" };
      if (["ml", "deep-learning", "pytorch", "tensorflow", "nlp", "transformer", "neural"].some((x) => t.includes(x)))
        return { top: "AI & Machine Learning", sub: "Repositories" };
      if (["data", "pandas", "spark", "jupyter", "analytics"].some((x) => t.includes(x)))
        return { top: "Data Science", sub: "Repositories" };
      if (["android", "aosp", "mobile", "ios", "react-native", "flutter"].some((x) => t.includes(x)))
        return { top: "Web Development", sub: "Repositories" };
      return { top: "Web Development", sub: "Repositories" };
    }

    if (isYoutube(url)) return { top: "Learning", sub: "Video & Channels" };

    if (
      [
        "coursera.org",
        "edx.org",
        "udemy.com",
        "pluralsight.com",
        "freecodecamp.org",
        "codecademy.com",
        "leetcode.com",
        "hackerrank.com",
        "exercism.org",
        "mit.edu",
        "ocw.mit.edu",
        "classcentral.com",
      ].some((x) => host.includes(x)) ||
      ["course", "tutorial series", "bootcamp"].some((x) => t.includes(x))
    )
      return { top: "Learning", sub: "Courses & Platforms" };

    if (
      (host === "python.org" && pathL.includes("/doc")) ||
      (host.includes("nodejs.dev") && pathL.includes("learn")) ||
      (host.includes("docs.oracle.com") && pathL.includes("java")) ||
      [
        "learn.go.dev",
        "nim-lang.org",
        "learn-c.org",
        "learn-cpp.org",
        "bash.academy",
        "rust-lang.org",
        "go.dev",
      ].some((x) => host.includes(x))
    )
      return { top: "Learning", sub: "Language Docs" };

    if (host.includes("mozilla.org") || t.includes("firefox"))
      return { top: "Archive", sub: "Browser Defaults" };

    if (["prothomalo.com", "bdstall.com", "fossbytes.com"].some((x) => host.includes(x)))
      return { top: "Archive", sub: "News & Shopping" };

    if (["telegram.org", "web.telegram", "t.me"].some((x) => host.includes(x)))
      return { top: "Productivity", sub: "Communication" };

    if (t.includes("proxy") || host.includes("proxy6")) return { top: "Security", sub: "Tools" };
    if (host.includes("asciinema.org")) return { top: "Web Development", sub: "Tools" };

    if (host.includes("google.") || host.endsWith(".google.com")) {
      if (
        ["aistudio.google", "gemini.google", "bard.google", "labs.google", "notebooklm.google", "colab.research.google"].some(
          (x) => u.includes(x)
        )
      )
        return { top: "AI & Machine Learning", sub: null };
      if (host.includes("scholar.google") || host.includes("patents.google")) return { top: "Research", sub: null };
      if (
        [
          "drive.google",
          "docs.google",
          "mail.google",
          "calendar.google",
          "keep.google",
          "photos.google",
          "meet.google",
          "hangouts.google",
          "myaccount.google",
          "contacts.google",
          "script.google",
          "sheets.google",
          "slides.google",
          "forms.google",
          "sites.google",
          "maps.google",
          "earth.google",
          "translate.google",
        ].some((x) => host.includes(x))
      )
        return { top: "Productivity", sub: null };
      if (host.includes("news.google")) return { top: "Archive", sub: "News & Shopping" };
      if (u.includes("chrome.google.com/webstore")) return { top: "Web Development", sub: "Tools" };
      if (host.includes("developers.google.com") || host.includes("cloud.google.com"))
        return { top: "Web Development", sub: "Reference & Learning" };
      if (u.includes("google.com/finance")) return { top: "Career & Jobs", sub: null };
      return { top: "Archive", sub: "General Web" };
    }

    if (host.includes("microsoft.com") && (u.includes("learn.microsoft") || u.includes("docs.microsoft")))
      return { top: "Learning", sub: "Courses & Platforms" };

    if (["poe.com", "kimi.com", "kimi.moonshot.cn", "yupp.ai", "claude.ai"].some((x) => host.includes(x)))
      return { top: "AI & Machine Learning", sub: "Tools" };

    if (host.includes("mega.nz") || host.includes("mega.io"))
      return { top: "Productivity", sub: "File & Cloud" };

    if (host.includes("reddit.com")) return { top: "Archive", sub: "Forums & Threads" };
    if (host.includes("roadmap.sh")) return { top: "Web Development", sub: "Reference & Learning" };
    if (host.includes("overleaf.com")) return { top: "Research", sub: "Writing & Publishing" };
    if (host.includes("thenounproject.com")) return { top: "Design", sub: null };

    if (["colorlib.com", "html5up.com", "free-css.com"].some((x) => host.includes(x)))
      return { top: "Web Development", sub: "Reference & Learning" };
    if (host.includes("github.io")) return { top: "Web Development", sub: "Reference & Learning" };

    if (
      [
        "windowscentral.com",
        "forums.tomshardware.com",
        "androidfilehost.com",
        "forum.xda-developers.com",
        "xdaforums.com",
        "lenovo.com",
        "download.lenovo.com",
        "support.lenovo.com",
        "hetmanrecovery.com",
      ].some((x) => host.includes(x))
    )
      return { top: "Linux & Systems", sub: "Hardware & OEM" };

    if (host.startsWith("192.168.") || host.startsWith("10.") || host === "localhost" || host === "127.0.0.1")
      return { top: "Archive", sub: "Local & Network" };

    if (["trickbd.com", "wirebd.com"].some((x) => host.includes(x)))
      return { top: "Archive", sub: "Regional Tech Communities" };

    if (
      [".edu.bd", "ipscctg.edu.bd", ".ac.uk"].some((x) => host.includes(x)) ||
      (host.endsWith(".edu") && !host.includes("google"))
    )
      return { top: "Learning", sub: "Institutions" };

    if (["medium.com", "dev.to", "substack.com", "hashnode.com"].some((x) => host.includes(x)))
      return { top: "Learning", sub: "Articles & Blogs" };

    if (["geeksforgeeks.org", "tutorialspoint.com", "javatpoint.com", "baeldung.com"].some((x) => host.includes(x)))
      return { top: "Web Development", sub: "Reference & Learning" };

    if (host.includes("sourceforge.net")) return { top: "Web Development", sub: "Tools" };
    if (host.includes("ncase.me")) return { top: "Learning", sub: "Articles & Blogs" };
    if (host.includes("toastytech.com")) return { top: "Archive", sub: "Random Links" };

    if (host.includes("whatsapp")) return { top: "Productivity", sub: "Communication" };
    if (["learnpython.org", "learn-js.org", "sqlbolt.com", "sqlzoo.net"].some((x) => host.includes(x)))
      return { top: "Learning", sub: "Language Docs" };
    if (["replit.com", "github.dev", "codesandbox.io", "stackblitz.com", "godbolt.org"].some((x) => host.includes(x)))
      return { top: "Web Development", sub: "Tools" };
    if (host.includes("phind.com") || host.includes("perplexity.ai"))
      return { top: "AI & Machine Learning", sub: "Tools" };
    if (host.includes("ninite.com")) return { top: "Productivity", sub: null };
    if (host.includes("cloudflare.com")) return { top: "Web Development", sub: "Reference & Learning" };
    if (["linuxmint.com", "kde.org", "opensuse.org", "gentoo.org"].some((x) => host.includes(x)))
      return { top: "Linux & Systems", sub: null };
    if (host.includes("microsoft.com")) return { top: "Archive", sub: "General Web" };
    if (["seeklogo.com", "originalmockups.com", "freepik.com", "flaticon.com"].some((x) => host.includes(x)))
      return { top: "Design", sub: null };
    if (["mediafire.com", "zippyshare.com", "uploaded.net"].some((x) => host.includes(x)))
      return { top: "Productivity", sub: "File & Cloud" };
    if (host.includes("programming-hero.com") || host.includes("scrimba.com"))
      return { top: "Learning", sub: "Courses & Platforms" };
    if (host.includes("keybr.com") || host.includes("typing.com"))
      return { top: "Learning", sub: "Courses & Platforms" };
    if (host.includes("discord.com") || host.includes("discord.gg") || host.endsWith(".funnez.com"))
      return { top: "Archive", sub: "Social & Leisure" };
    if (host.includes("speedtest") || host.includes("shouldispeed"))
      return { top: "Archive", sub: "Local & Network" };
    if (host.includes("onedrive.live.com") || (host.includes("live.com") && u.includes("onedrive")))
      return { top: "Productivity", sub: "File & Cloud" };
    if (["wikitrivia", "dripdrop.live", "cheatography.com"].some((x) => host.includes(x)))
      return { top: "Archive", sub: "Games & Quizzes" };
    if (["tr-ex.me", "deepl.com", "linguee.com"].some((x) => host.includes(x)))
      return { top: "Productivity", sub: null };
    if (host.includes("maketecheasier.com") || host.includes("howtogeek.com"))
      return { top: "Linux & Systems", sub: "Hardware & OEM" };
    if (host.includes("bbs.gov.bd") || host.includes("portal.gov.bd"))
      return { top: "Archive", sub: "Regional Tech Communities" };

    return { top: "Archive", sub: "Uncategorized" };
}
