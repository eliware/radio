function xml(value) {
  return String(value).replace(
    /[<>&"']/g,
    (character) =>
      ({
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        '"': "&quot;",
        "'": "&apos;",
      })[character],
  );
}

export function createIcecastConfig(password) {
  if (typeof password !== "string" || password.length < 16) {
    throw new Error("ICECAST_SOURCE_PASSWORD must contain at least 16 characters");
  }
  const safePassword = xml(password);
  return `<?xml version="1.0"?>
<icecast>
  <limits><clients>20</clients><sources>4</sources><queue-size>262144</queue-size>
    <burst-size>12288</burst-size><burst-on-connect>0</burst-on-connect></limits>
  <authentication><source-password>${safePassword}</source-password>
    <relay-password>${safePassword}</relay-password><admin-user>admin</admin-user>
    <admin-password>${safePassword}</admin-password></authentication>
  <location>Private network</location><admin>radar@eliware.org</admin>
  <hostname>radio</hostname>
  <listen-socket><port>8000</port><bind-address>0.0.0.0</bind-address></listen-socket>
  <paths><basedir>/usr/share/icecast2</basedir><logdir>/tmp</logdir>
    <webroot>/usr/share/icecast2/web</webroot><adminroot>/usr/share/icecast2/admin</adminroot>
  </paths>
  <logging><accesslog>access.log</accesslog><errorlog>error.log</errorlog>
    <loglevel>3</loglevel></logging>
  <security><chroot>0</chroot></security>
</icecast>`;
}
