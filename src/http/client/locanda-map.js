(() => {
  const layout = document.querySelector('.results-layout');
  if (!layout || document.querySelector('.locanda-map-panel')) return;

  const panel = document.createElement('aside');
  panel.className = 'locanda-map-panel';
  panel.setAttribute('aria-label', 'Location view');
  panel.innerHTML = `
    <div class="locanda-map-toolbar" role="group" aria-label="Map mode">
      <button class="is-active" type="button" data-map-mode="guest">Guest map</button>
      <button type="button" data-map-mode="market">God's Eye</button>
    </div>
    <div class="locanda-map" data-map-canvas>
      <div class="locanda-map-copy">
        <strong>Jareed, Riyadh</strong>
        <span>Explore homes around the neighbourhood</span>
      </div>
      <span class="map-road road-one"></span><span class="map-road road-two"></span>
      <button type="button" class="map-pin pin-home" aria-label="Locanda Homes">L</button>
      <button type="button" class="map-pin pin-nearby" aria-label="Nearby landmark">+</button>
      <div class="locanda-map-legend">Homes</div>
    </div>
    <p class="locanda-map-note">Guest map shows the home area. God's Eye is a preview surface for verified market signals when a data feed is connected.</p>`;
  layout.append(panel);

  const canvas = panel.querySelector('[data-map-canvas]');
  const copy = panel.querySelector('.locanda-map-copy');
  const note = panel.querySelector('.locanda-map-note');
  for (const button of panel.querySelectorAll('[data-map-mode]')) {
    button.addEventListener('click', () => {
      const market = button.dataset.mapMode === 'market';
      panel.querySelectorAll('[data-map-mode]').forEach((item) => item.classList.toggle('is-active', item === button));
      canvas.classList.toggle('is-market', market);
      copy.innerHTML = market
        ? '<strong>God\'s Eye · preview</strong><span>Verified supply and demand overlays appear here when connected.</span>'
        : '<strong>Jareed, Riyadh</strong><span>Explore homes around the neighbourhood</span>';
      note.textContent = market
        ? 'No live pricing, availability, or competitor data is shown until an authorised, verified market feed is connected.'
        : 'Guest map shows the home area. Exact arrival instructions are shared only with a confirmed guest.';
    });
  }
})();
