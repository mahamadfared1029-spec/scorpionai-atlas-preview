export const CONTACT_TIME = 7.4;
export const INTRO_DURATION = 8.2;
const clamp = x => Math.max(0, Math.min(1, x));
const ease = x => { x=clamp(x); return x*x*(3-2*x); };
export function shouldAutoStart({seen=false,reduced=false,hash=''}) {
  return !seen&&!reduced&&(!hash||hash==='#home');
}

export function sampleIntro(seconds) {
  const t=Math.max(0,seconds),orbit=ease(t/3.2),face=ease((t-3.2)/1.2);
  const attempt=t>=4.4&&t<5.5?Math.sin(Math.PI*(t-4.4)/1.1)**2:0;
  const strike=ease((t-6.5)/.9);
  return {
    angle:-.9+1.55*orbit-.65*face,
    radius:3.9-.55*orbit+.28*attempt-.35*ease((t-5.5)/1),
    height:1.35-.5*orbit-.12*face,
    anticipation:face,attempt,strike,
    contact:t>=CONTACT_TIME,finished:t>=INTRO_DURATION,
    progress:clamp(t/INTRO_DURATION),
    phase:t<3.2?'orbit':t<4.4?'face':t<5.5?'warning':t<6.5?'prepare':t<CONTACT_TIME?'strike':'contact'
  };
}
