const frame = document.getElementById('atlas-anatomy-frame');
if (frame) {
  let visible = true;
  const send = data => frame.contentWindow?.postMessage(data, location.origin);
  window.addEventListener('message', event => {
    if (event.origin !== location.origin || event.source !== frame.contentWindow) return;
    if (event.data?.type !== 'atlas-anatomy-size') return;
    const height = event.data.height;
    if (Number.isFinite(height) && height >= 400 && height <= 6000) frame.style.height = (Math.ceil(height) + 2) + 'px';
  });
  frame.addEventListener('load', () => {
    send({type:'atlas-anatomy-measure'});
    send({type:'atlas-anatomy-visibility', visible});
  });
  send({type:'atlas-anatomy-measure'});
  new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    send({type:'atlas-anatomy-visibility', visible});
  }, {rootMargin:'150px'}).observe(frame);
}
