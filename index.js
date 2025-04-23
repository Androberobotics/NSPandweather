const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");
const app = express();
app.use(express.json());

const fallbackLocation = { name: "Oslo", lat: 59.91, lon: 10.75 };

// Hent koordinater fra Open-Meteo
async function getCoordinates(place) {
  try {
    const response = await axios.get(`https://geocoding-api.open-meteo.com/v1/search?name=${place}`);
    const result = response.data.results?.[0];
    if (!result) return fallbackLocation;
    return { name: result.name, lat: result.latitude, lon: result.longitude };
  } catch (err) {
    console.error("Geokoding feilet:", err.message);
    return fallbackLocation;
  }
}

// Hent værdata
async function getWeatherText(lat, lon, placeName) {
  try {
    const response = await axios.get(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weathercode`);
    const weather = response.data.current;
    return `I ${placeName} er det ${weather.temperature_2m}°C med værkode ${weather.weathercode}.`;
  } catch (err) {
    return "Klarte ikke hente værdata.";
  }
}

// Hent relevant nettsidetekst
async function getWebsiteText(userInput = "") {
  try {
    const { data } = await axios.get("https://nsp.no");
    const $ = cheerio.load(data);

    const allText = $("p").map((_, el) => $(el).text().trim()).get();
    const keywords = ["pris", "betaling", "kontakt", "åpent", "telefon", "epost"];
    const userWords = userInput.toLowerCase();

    const match = allText.find(p =>
      keywords.some(word => p.toLowerCase().includes(word) && userWords.includes(word))
    );

    return match || "Jeg fant ikke relevant info, men du kan lese mer på https://nsp.no";
  } catch (err) {
    console.error("Nettside-feil:", err.message);
    return "Klarte ikke hente innhold fra nettsiden.";
  }
}

// Webhook-endepunkt for Dialogflow
app.post("/webhook", async (req, res) => {
  const intent = req.body.queryResult.intent.displayName;
  const location = req.body.queryResult.parameters?.location;
  const place = typeof location === "string" ? location : location?.city || location?.country;

  if (intent === "get_weather" && place) {
    const { name, lat, lon } = await getCoordinates(place);
    const weatherText = await getWeatherText(lat, lon, name);
    return res.json({ fulfillmentText: weatherText });
  }

  if (intent === "get_website_info") {
    const userInput = req.body.queryResult.queryText;
    const siteText = await getWebsiteText(userInput);
    return res.json({ fulfillmentText: siteText });
  }

  res.json({ fulfillmentText: "Jeg forsto ikke forespørselen." });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🌐 Server kjører på port ${PORT}`);
});
