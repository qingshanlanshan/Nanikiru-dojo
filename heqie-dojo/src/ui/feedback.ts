import { h } from './dom';

// Free feedback: posted to the shared endpoint on wick.qshlab.com, which emails it to the author.
// Nothing is stored anywhere.
const ENDPOINT = 'https://wick.qshlab.com/api/feedback';

export function openFeedback() {
  const overlay = h('div', { class: 'sheet-overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': '意见反馈' });
  const close = () => overlay.remove();
  overlay.addEventListener('click', (e) => e.target === overlay && close());

  const message = h('textarea', { class: 'fb-input', rows: 5, maxlength: 4000, placeholder: '建议、bug、想要的新功能……' });
  const contact = h('input', { class: 'fb-input', maxlength: 200, placeholder: '邮箱或微信（选填，方便回复）' });
  // Never shown to people; bots fill it in.
  const trap = h('input', { class: 'fb-trap', tabindex: -1, autocomplete: 'off', 'aria-hidden': 'true' });
  const status = h('p', { class: 'muted small center' });
  const send = h('button', { class: 'btn btn-primary' }, '发送');

  send.addEventListener('click', async () => {
    if (!message.value.trim()) {
      message.focus();
      return;
    }
    send.setAttribute('disabled', '');
    status.textContent = '发送中…';
    try {
      const r = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          product: 'heqie',
          message: message.value.trim(),
          contact: contact.value.trim(),
          website: trap.value,
          source: `heqie ${location.host}`,
          language: navigator.language,
        }),
      });
      if (r.ok) {
        status.textContent = '谢谢！已发送。';
        message.value = '';
      } else {
        status.textContent = r.status === 429 ? '发送太频繁了，请稍后再试。' : '暂时无法发送，请稍后再试。';
      }
    } catch {
      status.textContent = '没有网络，内容已保留，联网后再试。';
    } finally {
      send.removeAttribute('disabled');
    }
  });

  overlay.append(
    h(
      'div',
      { class: 'sheet feedback-sheet' },
      h('h3', {}, '意见反馈'),
      h('p', { class: 'muted small center' }, '免费留言，直接以邮件发给作者，不会被保存。'),
      message,
      contact,
      trap,
      status,
      h('div', { class: 'actions' }, send, h('button', { class: 'btn', onclick: close }, '关闭')),
    ),
  );
  document.body.append(overlay);
  message.focus();
}
