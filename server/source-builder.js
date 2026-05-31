import { copyFile, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { getVideoRoot, resolveInside } from './paths.js'

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function sceneStartTimes(scenes) {
  let current = 0
  return scenes.map((scene) => {
    const start = current
    current += scene.durationSeconds
    return start
  })
}

export async function buildHyperFramesSource({ repoRoot, project }) {
  if (!project.scenePlan?.scenes?.length) throw new Error('Scene plan is required before source generation.')

  const root = getVideoRoot(repoRoot, project.id)
  const hyperframesDir = resolveInside(root, 'hyperframes')
  await mkdir(hyperframesDir, { recursive: true })

  const starts = sceneStartTimes(project.scenePlan.scenes)
  const narrationFile = project.narration?.audioPath ? 'narration.wav' : null
  if (project.narration?.audioPath) {
    await copyFile(resolveInside(repoRoot, project.narration.audioPath), resolveInside(hyperframesDir, narrationFile))
  }
  const scenes = project.scenePlan.scenes
    .map(
      (scene, index) => `<section id="scene-${scene.sceneNumber}" class="scene scene-${(index % 4) + 1}">
        <div class="sky">
          <span class="moon-cookie"></span>
          <span class="star star-a"></span>
          <span class="star star-b"></span>
          <span class="star star-c"></span>
        </div>
        <div class="characters" aria-hidden="true">
          <span class="cat"><span></span></span>
          <span class="dog"><span></span></span>
        </div>
        <article class="scene-card">
          <p class="scene-count">Scene ${scene.sceneNumber}</p>
          <h1>${escapeHtml(scene.onScreenText)}</h1>
          <p>${escapeHtml(scene.visualDirection)}</p>
        </article>
      </section>`,
    )
    .join('\n')

  const timeline = project.scenePlan.scenes
    .map((scene, index) => {
      const start = starts[index]
      const exitAt = Math.max(start + scene.durationSeconds - 0.45, start + 0.2)
      return [
        `tl.set("#scene-${scene.sceneNumber}", { opacity: 1 }, ${start});`,
        `tl.fromTo("#scene-${scene.sceneNumber} .scene-card", { y: 90, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, ease: "power3.out" }, ${start + 0.15});`,
        `tl.fromTo("#scene-${scene.sceneNumber} .moon-cookie", { scale: 0.7, opacity: 0.5 }, { scale: 1, opacity: 1, duration: 0.8, ease: "power2.out" }, ${start + 0.2});`,
        `tl.to("#scene-${scene.sceneNumber}", { opacity: 0, duration: 0.35, ease: "power2.in" }, ${exitAt});`,
      ].join('\n')
    })
    .join('\n')

  const audioTag = project.narration?.audioPath
    ? `<audio id="narration" data-start="0" data-duration="auto" data-track-index="20" src="${narrationFile}" data-volume="1"></audio>`
    : ''

  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <title>${escapeHtml(project.title)}</title>
    <style>
      body { margin: 0; background: #172035; color: #251b13; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
      #story-root {
        position: relative;
        width: 1080px;
        height: 1920px;
        overflow: hidden;
        background: linear-gradient(180deg, #263a63 0%, #725ca0 45%, #ffd58f 100%);
      }
      .scene {
        position: absolute;
        inset: 0;
        opacity: 0;
        overflow: hidden;
      }
      .scene-1 { background: linear-gradient(180deg, #203864 0%, #7b69ad 50%, #f7c67a 100%); }
      .scene-2 { background: linear-gradient(180deg, #1e4d62 0%, #73a56f 58%, #ffcc7a 100%); }
      .scene-3 { background: linear-gradient(180deg, #35215f 0%, #8d5c99 55%, #f4b36b 100%); }
      .scene-4 { background: linear-gradient(180deg, #173b4f 0%, #4e826d 55%, #f7df9f 100%); }
      .sky { position: absolute; inset: 0; }
      .moon-cookie {
        position: absolute;
        top: 150px;
        right: 120px;
        width: 220px;
        height: 220px;
        border-radius: 50%;
        background: radial-gradient(circle at 35% 35%, #fff5ba 0 16%, #f8c955 17% 60%, #c88735 61% 100%);
        box-shadow: 0 0 70px rgba(255, 228, 137, 0.95);
      }
      .star { position: absolute; width: 18px; height: 18px; border-radius: 50%; background: #fff3b0; box-shadow: 0 0 18px #fff3b0; }
      .star-a { left: 160px; top: 280px; }
      .star-b { left: 800px; top: 520px; }
      .star-c { left: 500px; top: 210px; }
      .characters {
        position: absolute;
        left: 110px;
        right: 110px;
        bottom: 190px;
        display: flex;
        justify-content: space-between;
        align-items: end;
      }
      .cat, .dog {
        position: relative;
        display: block;
        width: 250px;
        height: 250px;
        border-radius: 46% 46% 42% 42%;
        box-shadow: 0 28px 0 rgba(52, 38, 26, 0.16);
      }
      .cat { background: #f59d3d; }
      .dog { background: #d99545; width: 310px; }
      .cat::before, .cat::after {
        content: "";
        position: absolute;
        top: -48px;
        width: 96px;
        height: 96px;
        background: #f59d3d;
        transform: rotate(45deg);
      }
      .cat::before { left: 28px; }
      .cat::after { right: 28px; }
      .dog::before, .dog::after {
        content: "";
        position: absolute;
        top: 35px;
        width: 96px;
        height: 150px;
        border-radius: 48px;
        background: #8d5d34;
      }
      .dog::before { left: -45px; transform: rotate(12deg); }
      .dog::after { right: -45px; transform: rotate(-12deg); }
      .cat span, .dog span {
        position: absolute;
        left: 50%;
        top: 92px;
        width: 28px;
        height: 28px;
        border-radius: 50%;
        background: #251b13;
        box-shadow: 74px 0 0 #251b13;
        transform: translateX(-50%);
      }
      .scene-card {
        position: absolute;
        left: 74px;
        right: 74px;
        bottom: 560px;
        min-height: 440px;
        box-sizing: border-box;
        padding: 56px;
        border-radius: 44px;
        background: rgba(255, 248, 224, 0.94);
        box-shadow: 0 26px 70px rgba(20, 25, 45, 0.28);
      }
      .scene-count {
        margin: 0 0 18px;
        color: #7b4e24;
        font-size: 32px;
        font-weight: 800;
        text-transform: uppercase;
      }
      h1 {
        margin: 0 0 28px;
        color: #2b1b12;
        font-size: 76px;
        line-height: 0.98;
      }
      .scene-card p:last-child {
        margin: 0;
        color: #4b3526;
        font-size: 34px;
        line-height: 1.25;
      }
    </style>
  </head>
  <body>
    <main id="story-root" data-composition-id="moon-cookie-story" data-start="0" data-duration="${project.scenePlan.totalDurationSeconds}" data-width="1080" data-height="1920" data-track-index="0">
      ${audioTag}
      ${scenes}
    </main>
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <script>
      window.__timelines = window.__timelines || {};
      const tl = gsap.timeline({ paused: true });
      ${timeline}
      window.__timelines["moon-cookie-story"] = tl;
    </script>
  </body>
</html>
`

  const entryFile = resolveInside(hyperframesDir, 'index.html')
  const manifestPath = resolveInside(hyperframesDir, 'source-manifest.json')
  await writeFile(entryFile, html, 'utf8')
  await writeFile(manifestPath, `${JSON.stringify({ entryFile: 'index.html', width: 1080, height: 1920 }, null, 2)}\n`, 'utf8')

  return {
    sourceFolder: path.relative(repoRoot, hyperframesDir),
    entryFile: path.relative(repoRoot, entryFile),
    manifestPath: path.relative(repoRoot, manifestPath),
    status: 'source_ready',
  }
}
