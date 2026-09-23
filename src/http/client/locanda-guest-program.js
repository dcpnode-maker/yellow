(() => {
  const reserve = document.querySelector('.reserve-card');
  if (!reserve || document.querySelector('.guest-program')) return;
  const program = document.createElement('section');
  program.className = 'guest-program';
  program.innerHTML = `
    <div class="guest-program-head"><span>LOCANDA MEMBERS</span><strong>Member journey preview</strong></div>
    <p>Member status, stay preferences and reviews are connected to a verified completed stay—not a public profile alone.</p>
    <div class="stay-preferences">
      <label><input type="checkbox" name="earlyArrival"> Request early check-in <small>Subject to property approval and final price</small></label>
      <label><input type="checkbox" name="lateDeparture"> Request late checkout <small>Subject to property approval and final price</small></label>
    </div>
    <button type="button" class="program-action">Save stay preferences</button>
    <p class="program-status" role="status"></p>
    <div class="program-divider"></div>
    <strong class="program-subtitle">Guest & host reviews</strong>
    <p class="review-summary">After a completed stay, the guest and host each submit a time-bound review. Only eligible, moderated reviews contribute to trust signals.</p>
    <div class="review-row"><span class="review-avatar">SA</span><span><strong>Samira A.</strong><small>Verified-stay review example · Jareed</small></span><b>★ 5.0</b></div>
    <p class="program-guardrail">Preview only: this does not charge a card, issue points, change a membership tier, or publish a review.</p>`;
  reserve.insertAdjacentElement('afterend', program);
  program.querySelector('.program-action').addEventListener('click', () => {
    const selected = [...program.querySelectorAll('input:checked')].map((input) => input.name === 'earlyArrival' ? 'early check-in' : 'late checkout');
    program.querySelector('.program-status').textContent = selected.length
      ? `Preference saved for this booking enquiry: ${selected.join(' and ')}. A host must approve availability and price.`
      : 'Choose a stay preference to include it with your booking enquiry.';
  });
})();
