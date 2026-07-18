self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var targetUrl = event.notification.data && event.notification.data.targetUrl;
  if (!targetUrl) return;

  var absoluteUrl = new URL(targetUrl, self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clients) {
      if (clients.length > 0) {
        var client = clients[0];
        return client.focus().then(function () {
          return client.navigate(absoluteUrl);
        });
      }
      return self.clients.openWindow(absoluteUrl);
    })
  );
});
