const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;
export const captchaEnabled = Boolean(siteKey);
let widget;
let script;
let token = '';

export function resetCaptcha() {
  token = '';
  if (widget !== undefined) window.turnstile.remove(widget);
  widget = undefined;
}

export function captchaToken() {
  return token;
}

export async function mountCaptcha(container, onError) {
  if (!captchaEnabled || !container) return;
  script ??= new Promise((resolve, reject) => {
    if (window.turnstile) return resolve(window.turnstile);
    const tag = document.createElement('script');
    tag.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    tag.async = true;
    tag.onload = () => resolve(window.turnstile);
    tag.onerror = () => { script = undefined; tag.remove(); reject(); };
    document.head.append(tag);
  });
  try {
    const turnstile = await script;
    if (!container.isConnected) return;
    widget = turnstile.render(container, {
      sitekey: siteKey,
      size: 'flexible',
      callback: value => { token = value; },
      'expired-callback': () => { token = ''; },
      'error-callback': () => { token = ''; onError(); },
    });
  } catch {
    if (container.isConnected) onError();
  }
}
