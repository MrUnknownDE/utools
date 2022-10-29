// Google Maps

// Initialize and add the map
function initMap() {
    // The map, centered at Uluru
    const map = new google.maps.Map(document.getElementById("map"), {
      zoom: 4,
      center: '{$details->loc}',
    });
    // The marker, positioned at Uluru
    const marker = new google.maps.Marker({
      position: {'{$details->loc}',
      map: map,
    });
  }
  
window.initMap = initMap;