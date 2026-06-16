import { copyFile, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { createSoftMusicBed } from './audio-bed.js'
import { getVideoRoot, resolveInside } from './paths.js'

const compositionId = 'cinematic-story'

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function getGenerationSettings(project) {
  return {
    durationMode: project.idea?.generationSettings?.durationMode ?? 'voice_led',
    visualComplexity: project.idea?.generationSettings?.visualComplexity ?? 'rich',
    pacing: project.idea?.generationSettings?.pacing ?? 'natural',
    captions: project.idea?.generationSettings?.captions ?? 'burned_in',
    audioMix: project.idea?.generationSettings?.audioMix ?? 'voice_only',
  }
}

function getTemplateFamily(project) {
  if (project.formatStrategy?.formatType === 'multi_image_story') return 'multi_image_story'
  return 'programmatic_explainer'
}

function formatSeconds(value) {
  return Number(value.toFixed(2)).toString()
}

function getPlannedDurationSeconds(scenePlan) {
  const sceneTotal = scenePlan.scenes.reduce((sum, scene) => sum + scene.durationSeconds, 0)
  return Math.max(1, scenePlan.totalDurationSeconds ?? sceneTotal)
}

function getVideoDurationSeconds(project, settings) {
  const plannedDuration = getPlannedDurationSeconds(project.scenePlan)
  if (settings.durationMode === 'voice_led' && Number.isFinite(project.narration?.durationSeconds)) {
    return Math.max(plannedDuration, project.narration.durationSeconds)
  }
  return plannedDuration
}

function buildSceneTiming(scenes, targetDurationSeconds) {
  const plannedDuration = Math.max(
    1,
    scenes.reduce((sum, scene) => sum + scene.durationSeconds, 0),
  )
  let current = 0
  return scenes.map((scene, index) => {
    const isLast = index === scenes.length - 1
    const duration = isLast ? targetDurationSeconds - current : (scene.durationSeconds / plannedDuration) * targetDurationSeconds
    const safeDuration = Math.max(1, duration)
    const timing = {
      scene,
      start: current,
      duration: safeDuration,
      end: isLast ? targetDurationSeconds : current + safeDuration,
    }
    current = timing.end
    return timing
  })
}

function sceneText(scene) {
  return `${scene.visualDirection} ${scene.onScreenText} ${scene.motionNotes} ${scene.audioNotes}`.toLowerCase()
}

function hasAny(text, words) {
  return words.some((word) => text.includes(word))
}

function classifyScene(scene, index) {
  const text = sceneText(scene)
  if (hasAny(text, ['basket', 'town', 'crowd', 'fruit', 'apple', 'pear', 'plum'])) return 'motif-gathering'
  if (hasAny(text, ['door', 'window', 'street', 'girl', 'child', 'coin', 'sidewalk'])) return 'motif-doorway'
  if (hasAny(text, ['slice', 'custard', 'glaze', 'oven', 'bake', 'tart', 'pastry', 'workbench'])) return 'motif-workbench'
  if (hasAny(text, ['bakery', 'kitchen', 'peach', 'cookie', 'food', 'garden'])) return 'motif-food'
  return `motif-memory-${(index % 3) + 1}`
}

function getSceneProps(scene, index) {
  const text = sceneText(scene)
  const props = new Set(['light'])
  if (hasAny(text, ['bakery', 'kitchen', 'workbench', 'counter', 'oven', 'flour', 'bake', 'pastry', 'tart'])) props.add('counter')
  if (hasAny(text, ['window', 'street', 'door', 'sidewalk', 'cobblestone'])) props.add('window')
  if (hasAny(text, ['oven', 'glow', 'warm', 'dawn', 'sunrise'])) props.add('oven')
  if (hasAny(text, ['baker', 'mara', 'man', 'woman', 'he ', 'she ', 'hands', 'face'])) props.add('baker')
  if (hasAny(text, ['child', 'girl', 'mother', 'coin'])) props.add('child')
  if (text.includes('peach')) props.add('peach')
  if (text.includes('cookie')) props.add('cookie')
  if (hasAny(text, ['tart', 'pastry', 'custard', 'glaze'])) props.add('tart')
  if (hasAny(text, ['basket', 'town', 'crowd', 'fruit', 'apple', 'pear', 'plum'])) props.add('basket')
  if (hasAny(text, ['rain', 'wet', 'cobblestone'])) props.add('rain')
  if (index === 0 && !props.has('baker')) props.add('baker')
  return Array.from(props)
}

function renderPerson(kind) {
  return `<span class="person person-${kind}">
            <span class="person-head"></span>
            <span class="person-body"></span>
            <span class="person-arm arm-left"></span>
            <span class="person-arm arm-right"></span>
          </span>`
}

function renderFruitCluster() {
  return `<span class="basket basket-a"><span></span><span></span><span></span></span>
          <span class="basket basket-b"><span></span><span></span><span></span></span>
          <span class="basket basket-c"><span></span><span></span><span></span></span>`
}

function renderRain() {
  return `<span class="rain-line rain-a"></span>
          <span class="rain-line rain-b"></span>
          <span class="rain-line rain-c"></span>
          <span class="rain-line rain-d"></span>`
}

function renderSceneVisuals(scene, index) {
  const props = getSceneProps(scene, index)
  const propSet = new Set(props)
  return {
    props,
    html: `<div class="scene-glow" aria-hidden="true"></div>
        <div class="set-layer">
          ${propSet.has('window') ? '<span class="set-window"></span><span class="door-frame"></span>' : ''}
          ${propSet.has('counter') ? '<span class="counter-top"></span><span class="flour-dust dust-a"></span><span class="flour-dust dust-b"></span>' : ''}
          ${propSet.has('oven') ? '<span class="oven-glow"></span>' : ''}
        </div>
        <div class="prop-layer">
          ${propSet.has('peach') ? '<span class="prop prop-peach"></span>' : ''}
          ${propSet.has('cookie') ? '<span class="prop prop-cookie"></span>' : ''}
          ${propSet.has('tart') ? '<span class="prop prop-tart"><span></span></span>' : ''}
          ${propSet.has('basket') ? renderFruitCluster() : ''}
        </div>
        <div class="people-layer">
          ${propSet.has('baker') ? renderPerson('baker') : ''}
          ${propSet.has('child') ? renderPerson('child') : ''}
        </div>
        <div class="weather-layer">
          ${propSet.has('rain') ? renderRain() : ''}
        </div>`,
  }
}

function buildSceneMarkup({ scene }, index, settings) {
  const motif = classifyScene(scene, index)
  const visuals = renderSceneVisuals(scene, index)
  return {
    motif,
    props: visuals.props,
    html: `<section id="scene-${scene.sceneNumber}" class="scene scene-${(index % 4) + 1}" data-scene-motif="${motif}">
        <div class="visual-stage ${motif}" aria-hidden="true">
          ${visuals.html}
        </div>
        ${settings.captions === 'burned_in' ? `<p class="caption-strip">${escapeHtml(scene.onScreenText)}</p>` : ''}
      </section>`,
  }
}

function buildSceneTimeline({ scene, start, end, duration }, settings) {
  const captionStart = start + Math.min(0.65, duration * 0.25)
  return [
    `tl.set("#scene-${scene.sceneNumber}", { opacity: 1 }, ${formatSeconds(start)});`,
    `tl.fromTo("#scene-${scene.sceneNumber} .visual-stage", { opacity: 0.62, scale: 1.045 }, { opacity: 1, scale: 1, duration: 0.75, ease: "power2.out" }, ${formatSeconds(start)});`,
    `tl.to("#scene-${scene.sceneNumber} .visual-stage", { scale: 1.035, duration: ${formatSeconds(Math.max(1, duration - 0.2))}, ease: "none" }, ${formatSeconds(start + 0.12)});`,
    `tl.fromTo("#scene-${scene.sceneNumber} .set-layer", { y: 28, opacity: 0.65 }, { y: 0, opacity: 1, duration: 0.8, ease: "power2.out" }, ${formatSeconds(start + 0.15)});`,
    `tl.fromTo("#scene-${scene.sceneNumber} .prop, #scene-${scene.sceneNumber} .basket", { y: 54, opacity: 0, scale: 0.88 }, { y: 0, opacity: 1, scale: 1, duration: 0.75, stagger: 0.07, ease: "back.out(1.4)" }, ${formatSeconds(start + 0.28)});`,
    `tl.fromTo("#scene-${scene.sceneNumber} .person", { x: -34, opacity: 0 }, { x: 0, opacity: 1, duration: 0.8, stagger: 0.12, ease: "power2.out" }, ${formatSeconds(start + 0.42)});`,
    `tl.fromTo("#scene-${scene.sceneNumber} .rain-line", { y: -90, opacity: 0 }, { y: 80, opacity: 0.75, duration: 1.1, stagger: 0.11, repeat: 2, ease: "none" }, ${formatSeconds(start + 0.3)});`,
    settings.captions === 'burned_in'
      ? `tl.fromTo("#scene-${scene.sceneNumber} .caption-strip", { y: 34, opacity: 0 }, { y: 0, opacity: 1, duration: 0.35, ease: "power2.out" }, ${formatSeconds(captionStart)});`
      : '',
    `tl.to("#scene-${scene.sceneNumber}", { opacity: 0, duration: 0.35, ease: "power2.in" }, ${formatSeconds(end)});`,
  ].join('\n')
}

export async function buildHyperFramesSource({ repoRoot, project }) {
  if (!project.scenePlan?.scenes?.length) throw new Error('Scene plan is required before source generation.')

  const root = getVideoRoot(repoRoot, project.id)
  const hyperframesDir = resolveInside(root, 'hyperframes')
  await mkdir(hyperframesDir, { recursive: true })

  const settings = getGenerationSettings(project)
  const videoDurationSeconds = getVideoDurationSeconds(project, settings)
  const sceneTiming = buildSceneTiming(project.scenePlan.scenes, videoDurationSeconds)
  const narrationFile = project.narration?.audioPath ? 'narration.wav' : null
  const musicBedPath = settings.audioMix === 'soft_music' ? resolveInside(root, 'audio', 'music-bed.wav') : null
  if (project.narration?.audioPath) {
    await copyFile(resolveInside(repoRoot, project.narration.audioPath), resolveInside(hyperframesDir, narrationFile))
  }
  if (musicBedPath) {
    await mkdir(resolveInside(root, 'audio'), { recursive: true })
    await writeFile(musicBedPath, createSoftMusicBed({ durationSeconds: videoDurationSeconds }))
  }

  const sceneMarkup = sceneTiming.map((timing, index) => buildSceneMarkup(timing, index, settings))
  const scenes = sceneMarkup.map((item) => item.html).join('\n')
  const timeline = sceneTiming.map((timing) => buildSceneTimeline(timing, settings)).join('\n')

  const audioTag = project.narration?.audioPath
    ? `<audio id="narration" data-start="0" data-duration="auto" data-track-index="20" src="${narrationFile}" data-volume="1"></audio>`
    : ''

  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <title>${escapeHtml(project.title)}</title>
    <style>
      body { margin: 0; background: #171923; color: #fff8e7; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
      #story-root {
        position: relative;
        width: 1080px;
        height: 1920px;
        overflow: hidden;
        background: #171923;
      }
      .scene {
        position: absolute;
        inset: 0;
        opacity: 0;
        overflow: hidden;
      }
      .scene-1 { background: linear-gradient(180deg, #27344d 0%, #755f70 48%, #e7b86f 100%); }
      .scene-2 { background: linear-gradient(180deg, #163c48 0%, #4f745d 54%, #e8c77a 100%); }
      .scene-3 { background: linear-gradient(180deg, #2f294b 0%, #795a75 55%, #d99261 100%); }
      .scene-4 { background: linear-gradient(180deg, #19364a 0%, #487061 55%, #f1c887 100%); }
      .visual-stage {
        position: absolute;
        inset: 0;
        opacity: 0;
        transform-origin: 50% 58%;
      }
      .scene-glow {
        position: absolute;
        left: 80px;
        top: 160px;
        width: 850px;
        height: 920px;
        border-radius: 50%;
        background: radial-gradient(circle at 50% 44%, rgba(255, 232, 168, 0.62), rgba(255, 232, 168, 0.16) 42%, rgba(255, 232, 168, 0) 68%);
        filter: blur(8px);
      }
      .set-layer, .prop-layer, .people-layer, .weather-layer {
        position: absolute;
        inset: 0;
      }
      .set-window {
        position: absolute;
        left: 116px;
        top: 178px;
        width: 350px;
        height: 520px;
        border: 28px solid rgba(255, 244, 207, 0.72);
        border-radius: 28px;
        background: linear-gradient(180deg, rgba(55, 76, 104, 0.92), rgba(155, 187, 190, 0.38));
        box-shadow: 0 22px 60px rgba(20, 25, 33, 0.28);
      }
      .set-window::before, .set-window::after {
        content: "";
        position: absolute;
        background: rgba(255, 244, 207, 0.7);
      }
      .set-window::before { left: 50%; top: 0; width: 18px; height: 100%; transform: translateX(-50%); }
      .set-window::after { left: 0; top: 48%; width: 100%; height: 18px; }
      .door-frame {
        position: absolute;
        right: 110px;
        bottom: 230px;
        width: 290px;
        height: 610px;
        border-radius: 150px 150px 18px 18px;
        background: linear-gradient(180deg, rgba(255, 239, 190, 0.34), rgba(86, 54, 36, 0.88));
        box-shadow: inset 0 0 0 20px rgba(255, 241, 198, 0.28), 0 28px 70px rgba(18, 21, 29, 0.3);
      }
      .counter-top {
        position: absolute;
        left: 70px;
        right: 70px;
        bottom: 290px;
        height: 210px;
        border-radius: 40px;
        background: linear-gradient(180deg, #f1d299 0%, #b97945 100%);
        box-shadow: 0 38px 80px rgba(28, 23, 20, 0.26);
      }
      .counter-top::after {
        content: "";
        position: absolute;
        left: 38px;
        right: 38px;
        top: 42px;
        height: 28px;
        border-radius: 999px;
        background: rgba(255, 248, 226, 0.36);
      }
      .oven-glow {
        position: absolute;
        right: 105px;
        top: 405px;
        width: 340px;
        height: 250px;
        border-radius: 48px;
        background: radial-gradient(circle at 50% 64%, #ffe0a0, #d98242 62%, #5a332b 100%);
        box-shadow: 0 0 95px rgba(255, 175, 76, 0.68);
      }
      .flour-dust {
        position: absolute;
        width: 150px;
        height: 26px;
        border-radius: 999px;
        background: rgba(255, 249, 230, 0.68);
        filter: blur(1px);
      }
      .dust-a { left: 210px; bottom: 455px; transform: rotate(-7deg); }
      .dust-b { left: 520px; bottom: 390px; width: 110px; transform: rotate(9deg); }
      .prop {
        position: absolute;
        display: block;
        opacity: 0;
      }
      .prop-peach {
        left: 415px;
        top: 655px;
        width: 220px;
        height: 210px;
        border-radius: 52% 48% 57% 43%;
        background: radial-gradient(circle at 38% 34%, #fff0a8 0 10%, #ffbf5c 11% 46%, #ee7a5d 72%, #bb4a50 100%);
        box-shadow: 0 22px 60px rgba(91, 54, 38, 0.27), 0 0 44px rgba(255, 195, 105, 0.52);
      }
      .prop-peach::before {
        content: "";
        position: absolute;
        left: 100px;
        top: -38px;
        width: 82px;
        height: 50px;
        border-radius: 100% 0 100% 0;
        background: #618447;
        transform: rotate(-24deg);
      }
      .prop-cookie {
        left: 390px;
        top: 630px;
        width: 270px;
        height: 270px;
        border-radius: 50%;
        background: radial-gradient(circle at 38% 34%, #fff7bd 0 13%, #f0bd55 14% 62%, #b87938 63% 100%);
        box-shadow: 0 0 72px rgba(255, 230, 139, 0.86), 0 30px 70px rgba(31, 30, 25, 0.2);
      }
      .prop-tart {
        left: 300px;
        top: 710px;
        width: 470px;
        height: 220px;
        border-radius: 50%;
        background: radial-gradient(ellipse at 50% 45%, #ffd77c 0 35%, #e28a48 36% 62%, #9e5a34 63% 100%);
        box-shadow: 0 24px 62px rgba(55, 34, 26, 0.32);
      }
      .prop-tart span {
        position: absolute;
        left: 82px;
        top: 54px;
        width: 72px;
        height: 116px;
        border-radius: 50%;
        background: #ffbd67;
        transform: rotate(-35deg);
        box-shadow: 82px 18px 0 #f79b5b, 168px -2px 0 #ffc16e, 252px 16px 0 #ef8d56;
      }
      .basket {
        position: absolute;
        display: block;
        width: 230px;
        height: 130px;
        border-radius: 28px 28px 70px 70px;
        background: linear-gradient(180deg, #b87842, #754628);
        box-shadow: 0 22px 48px rgba(28, 22, 18, 0.24);
        opacity: 0;
      }
      .basket-a { left: 120px; bottom: 410px; }
      .basket-b { left: 430px; bottom: 330px; transform: scale(1.15); }
      .basket-c { right: 120px; bottom: 435px; }
      .basket::before {
        content: "";
        position: absolute;
        left: 46px;
        right: 46px;
        top: -50px;
        height: 90px;
        border: 18px solid #8b552f;
        border-bottom: 0;
        border-radius: 100px 100px 0 0;
      }
      .basket span {
        position: absolute;
        top: -28px;
        width: 64px;
        height: 64px;
        border-radius: 50%;
        background: #ef6f5b;
        box-shadow: 44px -18px 0 #e3b94c, 88px 0 0 #79a766;
      }
      .basket span:nth-child(1) { left: 28px; }
      .basket span:nth-child(2) { left: 72px; background: #d86a65; }
      .basket span:nth-child(3) { left: 118px; background: #e0a044; }
      .person {
        position: absolute;
        display: block;
        opacity: 0;
      }
      .person-baker {
        left: 180px;
        bottom: 520px;
        width: 260px;
        height: 500px;
      }
      .person-child {
        right: 178px;
        bottom: 440px;
        width: 190px;
        height: 380px;
        transform: scale(0.82);
      }
      .person-head {
        position: absolute;
        left: 50%;
        top: 0;
        width: 132px;
        height: 132px;
        border-radius: 50%;
        background: linear-gradient(180deg, #ffd2ad, #b87354);
        transform: translateX(-50%);
        box-shadow: inset -16px -12px 0 rgba(86, 45, 34, 0.18);
      }
      .person-head::after {
        content: "";
        position: absolute;
        left: 30px;
        top: 58px;
        width: 17px;
        height: 17px;
        border-radius: 50%;
        background: #2f211b;
        box-shadow: 56px 0 0 #2f211b;
      }
      .person-baker .person-head::before {
        content: "";
        position: absolute;
        left: -18px;
        top: -36px;
        width: 170px;
        height: 80px;
        border-radius: 70px 70px 20px 20px;
        background: #f7efe2;
      }
      .person-body {
        position: absolute;
        left: 50%;
        top: 116px;
        width: 190px;
        height: 260px;
        border-radius: 76px 76px 34px 34px;
        background: linear-gradient(180deg, #f7efe2, #d4b98b);
        transform: translateX(-50%);
        box-shadow: inset 0 0 0 18px rgba(255, 255, 255, 0.18);
      }
      .person-child .person-body { background: linear-gradient(180deg, #795b8f, #43355f); }
      .person-arm {
        position: absolute;
        top: 170px;
        width: 105px;
        height: 30px;
        border-radius: 999px;
        background: #d99c7b;
      }
      .arm-left { left: 8px; transform: rotate(24deg); }
      .arm-right { right: 8px; transform: rotate(-24deg); }
      .rain-line {
        position: absolute;
        display: block;
        width: 5px;
        height: 145px;
        border-radius: 999px;
        background: rgba(215, 239, 255, 0.58);
        opacity: 0;
        transform: rotate(12deg);
      }
      .rain-a { left: 185px; top: 280px; }
      .rain-b { left: 395px; top: 150px; }
      .rain-c { right: 310px; top: 330px; }
      .rain-d { right: 120px; top: 210px; }
      .motif-workbench .counter-top { bottom: 250px; height: 270px; }
      .motif-doorway .person-baker { left: 128px; }
      .motif-doorway .person-child { right: 155px; bottom: 360px; }
      .motif-gathering .person-baker { left: 405px; bottom: 690px; transform: scale(0.86); }
      .motif-gathering .counter-top { opacity: 0.38; }
      .caption-strip {
        position: absolute;
        left: 74px;
        right: 74px;
        bottom: 86px;
        margin: 0;
        padding: 30px 38px;
        border-radius: 30px;
        background: rgba(22, 24, 34, 0.84);
        color: #fff7df;
        font-size: 46px;
        font-weight: 800;
        line-height: 1.08;
        opacity: 0;
        text-align: center;
        box-shadow: 0 16px 44px rgba(10, 12, 18, 0.24);
      }
    </style>
  </head>
  <body>
    <main id="story-root" data-composition-id="${compositionId}" data-start="0" data-duration="${formatSeconds(videoDurationSeconds)}" data-width="1080" data-height="1920" data-track-index="0">
      ${audioTag}
      ${scenes}
    </main>
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <script>
      window.__timelines = window.__timelines || {};
      const tl = gsap.timeline({ paused: true });
      ${timeline}
      window.__timelines["${compositionId}"] = tl;
    </script>
  </body>
</html>
`

  const entryFile = resolveInside(hyperframesDir, 'index.html')
  const manifestPath = resolveInside(hyperframesDir, 'source-manifest.json')
  await writeFile(entryFile, html, 'utf8')
  await writeFile(
    manifestPath,
    `${JSON.stringify(
      {
        entryFile: 'index.html',
        width: 1080,
        height: 1920,
        renderStyle: 'cinematic_scene_layers',
        formatType: project.formatStrategy?.formatType ?? 'programmatic_explainer',
        templateFamily: getTemplateFamily(project),
        contentMoat: project.formatStrategy?.contentMoat ?? null,
        visualSystem: project.formatStrategy?.visualSystem ?? null,
        syncPriority: project.formatStrategy?.syncPriority ?? null,
        durationPolicy: settings.durationMode,
        visualDurationSeconds: videoDurationSeconds,
        audioDurationSeconds: project.narration?.durationSeconds ?? null,
        visualComplexity: settings.visualComplexity,
        pacing: settings.pacing,
        captions: settings.captions,
        audioMix: settings.audioMix,
        musicBedPath: musicBedPath ? path.relative(repoRoot, musicBedPath) : null,
        scenes: sceneTiming.map(({ scene, start, end, duration }, index) => ({
          sceneNumber: scene.sceneNumber,
          startSeconds: Number(formatSeconds(start)),
          durationSeconds: Number(formatSeconds(duration)),
          endSeconds: Number(formatSeconds(end)),
          motif: sceneMarkup[index].motif,
          props: sceneMarkup[index].props,
        })),
      },
      null,
      2,
    )}\n`,
    'utf8',
  )

  return {
    sourceFolder: path.relative(repoRoot, hyperframesDir),
    entryFile: path.relative(repoRoot, entryFile),
    manifestPath: path.relative(repoRoot, manifestPath),
    status: 'source_ready',
  }
}
