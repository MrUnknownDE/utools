<!DOCTYPE html>
<html lang="de">
<head>
<title>uTraceMe - IP Lookup</title>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="description" content="IP Lookup">
<meta name="keywords" content="ip lookup, what is my ip, my ip address, my ip, ip address lookup, ip geolocation, latitude longitude finder, ip lookup php script, ip2location, geolocation, ip-location, my ip lookup, ip-lookup, geoip, geo ip, ip finder, ip tools, ip tools, ip location finder, location finder, what is my ip location, ip address geolocation, ????? ????, ???? ???? ?????, ????? ip, ?????? ????">
<meta name="author" content="Johannes Krüger">
<script async src='https://maps.googleapis.com/maps/api/js?key=AIzaSyCMPtVMDhHelORhyk2AAc9FtjgnjybvdMU&callback=initMap&v=weekly'></script>
<script type="module" src="./maps.js"></script>
</head>
<body>

<h2>Lookup IP Address Location</h2>

<br>

<?php

// Variable
$IP = $_SERVER['REMOTE_ADDR'];
$ip = htmlentities($_GET["ip"]);
$latitude = htmlentities($_POST['latitude'], ENT_QUOTES, 'UTF-8');
$longitude = htmlentities($_POST['longitude'], ENT_QUOTES, 'UTF-8');
$city = htmlentities($_POST['city'], ENT_QUOTES, 'UTF-8');
$details = json_decode(file_get_contents("http://ipinfo.io/{$ip}/json?token=391da55dff40d9"));
$location = json_decode(file_get_contents("http://ipinfo.io/{$ip}/json?token=391da55dff40d9"));


// start public Code

if(isset($_GET['ip']))
{
echo '<form method="get" action="">
<input type="text" name="ip" id="ip" maxlength="32" placeholder="IP" title="Enter IP Address here" />
<input type="submit" class="button" value="Lookup IP Address" />
</form>';

echo "<br><br><b>Short View</b><br>";
echo "<b>IP: </b>" .$details->ip;
echo "<br><b>Organisation: </b>" .$details->org;
echo "<br><b>Stadt: </b>" .$details->city;
echo "<br><b>Postleitzahl: </b>" .$details->postal;
echo "<br><b>Bundesland: </b>" .$details->region;
echo "<br><b>Land: </b>" .$details->country;
echo "<br><b>Lage: </b>" .$details->loc;
echo "<br><b>Hostname (rDNS): </b>" .$details->hostname;
echo "<br>";


//echo "<div style="border-radius: 10px;width: 480px;height: 240px;"><iframe src='https://maps.googleapis.com/maps/api/staticmap?center={$details->loc}&markers=color:red%7Clabel:S{$details->loc}&zoom=10&size=480x240&key=AIzaSyCMPtVMDhHelORhyk2AAc9FtjgnjybvdMU' FRAMEBORDER=NO FRAMESPACING=0 BORDER=0 ></iframe></div><br>";

}

else {

print ('<form method="get" action="">
<input type="text" name="ip" id="ip" maxlength="15" placeholder="IP" title="Enter IP Address here" value="'.$IP.'" />
<input type="submit" class="button" value="Lookup IP Address" />
</form>');
echo "<br>Here's what you will find out:<br><br>
<li>Your IP (but you can check other IP)</li>
<li>IP type</li>
<li>Continent code</li> 
<li>Continent name</li> 
<li>Country code</li>
<li>Country name</li>
<li>City</li>
<li>State/Region</li>
<li>Region code</li>
<li>Zip code</li>
<li>Calling code</li>
<li>Latitude</li>
<li>Longitude</li>
<li>Timezone</li>
<li>Currency</li>
<li>Mobile</li>
<li>Proxy</li>
<li>Organization</li>
<li>Hostname</li>
<li>Your Browser User-Agent</li>
<li>Geolocation Map</li>
<li>Map Latitude Longitude finder</li>
";
}

?>
