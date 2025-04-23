const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");
const app = express();
app.use(express.json());

const fallbackLocation = {
  name: "Oslo",
  lat: 59.91,
  lon: 10.75
};

const weatherDescriptions = {
  0: "\u2600\ufe0f Klart", 1: "\ud83c\udf24\ufe0f Mest klart", 2: "\ud83c\udf25\ufe0f Delvis skyet", 3: "\u2601\ufe0f Overskyet",
  45: "\ud83c\udf2b\ufe0f T\u00e5ke", 48: "\ud83c\udf2b\ufe0f T\u00e5ke (rim)", 51: "\ud83c\udf26\ufe0f Lett yr", 53: "\ud83c\udf26\ufe0f Yr", 55: "\ud83c\udf27\ufe0f Kraftig yr",
  61: "\ud83c\udf26\ufe0f Lett regn", 63: "\ud83c\udf27\ufe0f Regn", 65: "\ud83c\udf27\ufe0f Kraftig regn", 71: "\ud83c\udf28\ufe0f Lett sn\u00f8",
  73: "\ud83c\udf28\ufe0f Sn\u00f8", 75: "\u2744\ufe0f Kraftig sn\u00f8", 80: "\ud83c\udf27\ufe0f Regnbyger", 95: "\u26c8\ufe0f Tordenv\u00e6r"
};

async function getCoordinates(place) {
  try {
    const response = await axios.get(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(place)}&count=1`);
    const result = response.data.results?.[0];
    if (!result) return fallbackLocation;
    return { name: result.name, lat: result.latitude, lon: result.longitude };
  } catch (err) {
    console.error("Geokoding feilet:", err.message);
    return fallbackLocation;
  }
}

async function getWeather(place) {
  const { name, lat, lon } = await getCoordinates(place);
  try {
    const response = await axios.get(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`);
    const weather = response.data.current_weather;
    const code = weather.weathercode;
    const description = weatherDescriptions[code] || "\ud83c\udf08 Ukjent v\u00e6r";
    return `\ud83d\udccd ${name}\n${description}\n\ud83c\udf21\ufe0f ${weather.temperature} \u00b0C\n\ud83d\udca8 ${weather.windspeed} m/s\n\ud83d\udd52 ${weather.time}`;
  } catch (err) {
    console.error("V\u00e6rfeil:", err.message);
    return "Klarte ikke hente v\u00e6rdata \u274c";
  }
}

async function getWebsiteInfo() {
  try {
    const { data } = await axios.get("https://nsp.no");
    const $ = cheerio.load(data);
    const text = $("body").text().toLowerCase();

    if (text.includes("kontakt")) return "\ud83d\udcde Du finner kontaktinfo p\u00e5 https://nsp.no";
    if (text.includes("produkter") || text.includes("tjenester")) return "\ud83d\uded9\ufe0f Du finner produkter og tjenester p\u00e5 https://nsp.no";
    if (text.includes("nyheter")) return "\ud83d\udcf0 Nettsiden inneholder nyheter og oppdateringer.";

    return "\u2139\ufe0f Du finner generell info p\u00e5 https://nsp.no";
  } catch (err) {
    console.error("Nettsidefeil:", err.message);
    return "\ud83d\udeab Klarte ikke hente nettsideinformasjon.";
  }
}

app.post("/webhook", async (req, res) => {
  const intent = req.body.queryResult.intent.displayName;

  if (intent === "get_weather") {
    const location = req.body.queryResult?.parameters?.location;
    const place = typeof location === "string" ? location : location?.city || location?.country || "Oslo";
    const weatherReply = await getWeather(place);
    return res.json({ fulfillmentText: weatherReply });

  } else if (intent === "get_website_info") {
    const websiteReply = await getWebsiteInfo();
    return res.json({ fulfillmentText: websiteReply });

  } else {
    return res.json({ fulfillmentText: "\ud83e\udd16 Beklager, jeg forsto ikke foresp\u00f8rselen." });
  }
});

app.get("/", (req, res) => res.send("Webhook for v\u00e6r og nettside kj\u00f8rer!"));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`\ud83d\ude80 Server kj\u00f8rer p\u00e5 port ${port}`));