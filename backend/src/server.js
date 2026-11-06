const express = require("express");
const cors = require("cors");
const swaggerUi = require("swagger-ui-express");
const YAML = require("yamljs");
const OpenAI = require("openai");
const {
  giftGenieSystemMessage,
  giftGenieExamples,
  giftGenieWebSystemMessage,
} = require("./giftGeniePrompt");
const { giftSchema } = require("./giftSchema");

require("dotenv").config();


const openai = new OpenAI({
    apiKey: process.env.AI_KEY,
    baseURL: process.env.AI_URL,
  });



const app = express();
const swaggerDocument = YAML.load("./openapi.yaml");

app.use(cors());
app.use(express.json());
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));


app.get("/api/gifts", (req, res) => {
  res.json([
    { id: 1, name: "Coffee Mug", category: "home", price: 15 },
    { id: 2, name: "Wireless Earbuds", category: "tech", price: 80 },
    { id: 3, name: "Notebook", category: "study", price: 10 },
  ]);
});


app.get("/api/ai-test", async (req, res) => {

    const userPrompt = `
    Suggest some gifts for someone who loves tennis but doesn't play anymore
    Make the suggestions thoughtful and practical.
    Your response must be under 100 words.
    Skip intros and conclusions.
    Only output gift suggestions.
    `;
    const userMessages = [
        {
            role: "user",
            content: userPrompt,
        }
    ];

  const response = await openai.chat.completions.create({
    model: process.env.AI_MODEL,
    max_tokens: 100,
    messages: userMessages
  });

  res.json({
    model: process.env.AI_MODEL,
    message: response.choices[0].message.content,
    finishReason: response.choices[0].finish_reason,
    usage: response.usage
  });
});


app.get("/api/ai-followup", async (req, res) => {

    // first user message
    const messages = [
        {
            role: "system",
            content: `Make these suggestions thoughtful and practical.
            Your response must be under 100 words.
            Skip intros and conclusions.
            Only output gift suggestions.`,
          },
          {
            role: "user",
            content: "Suggest some gifts for someone who loves hiphop music.",
          },
    ]

  const firstResponse = await openai.chat.completions.create({
    model: process.env.AI_MODEL,
    max_tokens: 300,
    messages,
  });

// first assestence message
  const firstAssistantMessage = firstResponse.choices[0].message;
  messages.push(firstAssistantMessage);


  // second user message
  messages.push({
    role: "user",
    content: "More budget friendly. Less than $40.",
  });


 // second response 
  const secondResponse = await openai.chat.completions.create({
    model: process.env.AI_MODEL,
    max_tokens: 300,
    messages,
  });

  res.json({
    first: firstResponse.choices[0].message.content,
    budgetFriendly: secondResponse.choices[0].message.content,
  });

});


app.post("/api/gift-genie", async (req, res) => {
    const { userPrompt } = req.body;
  
    const input = [
      giftGenieWebSystemMessage,
      { role: "user", content: userPrompt },
    ];

    try {
      const stream = await openai.responses.create({
        model: process.env.AI_MODEL,
        max_output_tokens: 100,
        temperature: 0.8,
        input,
        tools: [{ type: "web_search_preview" }],
        stream: true,
      });

      res.setHeader("Content-Type", "text/plain; charset=utf-8");

      for await (const event of stream) {
        if (event.type === "response.output_text.delta") {
          res.write(event.delta);
        }
      }

      res.end();
    } catch (error) {
      console.error(error);
      if (!res.headersSent) {
        res.status(500).json({
          error: "Sorry, I can't access what I need right now. Please try again.",
        });
      } else {
        res.end();
      }
    }
  });

app.get("/api/stream-test", async (req, res) => {

  const { userPrompt } = req.body;

  const messages = [
    giftGenieSystemMessage,
    { 
      role: "user",
      content: userPrompt
    },
  ];

  try {
    const stream = await openai.chat.completions.create({
      model: process.env.AI_MODEL,
      max_tokens: 1300,
      messages,
      stream: true,
    });

    res.setHeader("Content-Type", "text/plain; charset=utf-8");


    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content || "";
      console.log(text);
      res.write(text);
    }

    res.end();
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Sorry, I can't access what I need right now. Please try again.",
    });
  }
});

app.get("/api/responses-test", async (req, res) => {
  try {
    const response = await openai.responses.create({
      model: process.env.AI_MODEL,
      max_output_tokens: 300,
      input: [
        {
          role: "system",
          content: `You are the Gift Genie!
          Your gift suggestions should feel thoughtful, specific, and genuinely useful.
          Your response must be under 100 words.
          Start directly with the gift suggestions.
          Do not write an introduction or conclusion.`,
        },
        {
          role: "user",
          content: "Give me gift suggestions for my friend who likes hiphop music.",
        },
      ],
    });

    res.json({ message: response.output_text });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Responses API request failed." });
  }
});

app.get("/api/gift-json-native", async (req, res) => {
  try {
    const response = await openai.responses.create({
      model: process.env.AI_MODEL,
      max_output_tokens: 500,
      input: `Suggest 3 gifts for a coffee lover. Return as JSON array.
      Each gift should have: name, price_range, and why_its_good.`,
    });

    const raw = response.output_text;
    let parsed = true;
    try {
      JSON.parse(raw);
    } catch {
      parsed = false;
    }

    res.json({ parsed, raw });

  } catch {
    console.error(error);
    res.status(500).json({ error: "Request failed." });
  }
})


app.get("/api/gift-json", async (req, res) => {
  try {
    const response = await openai.responses.create({
      model: process.env.AI_MODEL,
      max_output_tokens: 500,
      input: "Suggest 3 gifts for a coffee lover.",
      text: {
        format: giftSchema,
      },
    });

    const data = JSON.parse(response.output_text);
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Request failed." });
  }
});


app.get("/api/web-search-test", async (req, res) => {
  try {
    const response = await openai.responses.create({
      model: process.env.AI_MODEL,
      max_output_tokens: 800,
      input: "Best coffee machines available right now under 300 euros.",
      tools: [{ type: "web_search_preview" }],
    });

    console.log(response.output.map((item) => item.type));
    res.json({ message: response.output_text });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Web search request failed." });
  }
});


const PORT = process.env.PORT || 5050;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});