import { tileCode } from '../engine/tiles';
import { h } from './dom';

// Spoiler-free share card (shows the hand and whether you got it, not the answer).
// 1080x1440 = 3:4, the 小红书 image ratio.

export interface ShareCard {
  title: string;
  date: string;
  level: string;
  tiles: number[];
  ok: boolean;
  streak: number;
  url: string;
}

const W = 1080;
const H = 1440;
const FONT = '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans SC", sans-serif';
const BASE = import.meta.env.BASE_URL;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export async function drawCard(card: ShareCard): Promise<HTMLCanvasElement> {
  const [front, ...faces] = await Promise.all([
    loadImage(`${BASE}tiles/front.svg`),
    ...card.tiles.map((t) => loadImage(`${BASE}tiles/${tileCode(t)}.svg`)),
  ]);
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  g.textAlign = 'center';
  g.textBaseline = 'middle';

  g.fillStyle = '#f4f1ea';
  g.fillRect(0, 0, W, H);

  g.fillStyle = '#1d2420';
  g.font = `700 76px ${FONT}`;
  g.fillText('何切道场', W / 2, 150);
  g.fillStyle = '#69716c';
  g.font = `400 38px ${FONT}`;
  g.fillText(`${card.title} · ${card.date}`, W / 2, 230);

  // Felt band with the hand
  const top = 320;
  const bandH = 420;
  const grad = g.createRadialGradient(W / 2, top, 50, W / 2, top + bandH / 2, W * 0.8);
  grad.addColorStop(0, '#1f5a45');
  grad.addColorStop(1, '#184a38');
  g.fillStyle = grad;
  g.fillRect(0, top, W, bandH);
  g.fillStyle = '#e9f2ec';
  g.font = `500 46px ${FONT}`;
  g.fillText(`${card.level} · 你切哪张？`, W / 2, top + 95);

  const tw = Math.floor((W - 60) / card.tiles.length);
  const th = Math.round((tw * 4) / 3);
  const x0 = (W - tw * card.tiles.length) / 2;
  const y0 = top + 190;
  card.tiles.forEach((_, i) => {
    const x = x0 + i * tw;
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.fillRect(x + 3, y0 + 5, tw - 4, th);
    g.drawImage(front, x, y0, tw - 2, th);
    g.drawImage(faces[i], x, y0, tw - 2, th);
  });

  g.fillStyle = card.ok ? '#1f8a4c' : '#c2412d';
  g.font = `700 96px ${FONT}`;
  g.fillText(card.ok ? '✓ 我答对了' : '✗ 我答错了', W / 2, 900);
  if (card.streak > 1) {
    g.fillStyle = '#c8963e';
    g.font = `500 44px ${FONT}`;
    g.fillText(`已连续打卡 ${card.streak} 天`, W / 2, 1000);
  }

  g.fillStyle = '#1d2420';
  g.font = `500 42px ${FONT}`;
  g.fillText('你会切哪张？来试试 ↓', W / 2, 1190);
  g.fillStyle = '#1f5a45';
  g.font = `600 40px ${FONT}`;
  g.fillText(card.url.replace(/^https?:\/\//, '').replace(/#.*$/, '').replace(/\/$/, ''), W / 2, 1260);
  g.fillStyle = '#69716c';
  g.font = `400 32px ${FONT}`;
  g.fillText('免费 · 无需注册 · 每天一题', W / 2, 1320);
  return c;
}

export async function openShare(card: ShareCard) {
  const overlay = h('div', { class: 'sheet-overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': '分享' });
  const close = () => overlay.remove();
  overlay.addEventListener('click', (e) => e.target === overlay && close());
  const body = h('div', { class: 'sheet' }, h('p', { class: 'muted center' }, '正在生成…'));
  overlay.append(body);
  document.body.append(overlay);

  let canvas: HTMLCanvasElement;
  try {
    canvas = await drawCard(card);
  } catch {
    body.replaceChildren(h('p', { class: 'center' }, '生成失败，请重试。'), h('button', { class: 'btn', onclick: close }, '关闭'));
    return;
  }
  const dataUrl = canvas.toDataURL('image/png');
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'));
  const file = blob ? new File([blob], `heqie-${card.date}.png`, { type: 'image/png' }) : null;

  const status = h('p', { class: 'muted center small' }, '长按图片保存，发到群里或小红书');
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(card.url);
      status.textContent = '链接已复制';
    } catch {
      status.textContent = `复制失败，请手动复制：${card.url}`;
    }
  };
  const canShareFile = !!file && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });

  body.replaceChildren(
    h('img', { class: 'sheet-img', src: dataUrl, alt: '分享图' }),
    status,
    h(
      'div',
      { class: 'actions' },
      canShareFile
        ? h('button', {
            class: 'btn btn-primary',
            onclick: () => navigator.share({ files: [file!], text: `${card.title}，你会切哪张？ ${card.url}` }).catch(() => {}),
          }, '分享')
        : null,
      h('a', { class: 'btn', href: dataUrl, download: `heqie-${card.date}.png` }, '下载图片'),
      h('button', { class: 'btn', onclick: copyLink }, '复制链接'),
      h('button', { class: 'btn', onclick: close }, '关闭'),
    ),
  );
}
