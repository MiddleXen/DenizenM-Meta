/**
 * Flasher and smooth scroll utility for Denizen Meta documentation
 */
function doFlashFor(elementId, e) {
  if (e && e.preventDefault) {
    e.preventDefault();
  } else if (typeof window !== 'undefined' && window.event && window.event.preventDefault) {
    window.event.preventDefault();
  }

  if (!elementId) return;
  var flashable = document.getElementById(elementId);
  if (!flashable) return;

  // Find nearest table card or element itself
  var target = flashable.closest('table') || flashable;

  target.classList.remove('flash');
  // Trigger DOM reflow to restart CSS animation
  void target.offsetWidth;
  target.classList.add('flash');

  // Offset by 70px so the table header is cleanly below the sticky top navbar
  var rect = target.getBoundingClientRect();
  var targetY = Math.max(0, rect.top + (window.pageYOffset || window.scrollY || 0) - 70);

  window.scrollTo({
    top: targetY,
    behavior: 'smooth'
  });

  // Update hash in URL without triggering native browser jump
  if (window.history && window.history.pushState) {
    window.history.pushState(null, '', '#' + elementId);
  }
}

function autoflash() {
  var hash = window.location.hash;
  if (!hash || hash.length < 2) return;
  var targetId = decodeURIComponent(hash.substring(1));
  setTimeout(function() {
    doFlashFor(targetId);
  }, 100);
}

if (typeof window !== 'undefined') {
  window.doFlashFor = doFlashFor;
  window.autoflash = autoflash;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoflash);
  } else {
    autoflash();
  }

  window.addEventListener('hashchange', autoflash);
}
