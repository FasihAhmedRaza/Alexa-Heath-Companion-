import express from 'express';
import Alexa, { SkillBuilders } from 'ask-sdk-core';
import morgan from 'morgan';
import { ExpressAdapter } from 'ask-sdk-express-adapter';
import OpenAI from 'openai';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

const app = express();
app.use(morgan('dev'));
const PORT = process.env.PORT || 3000;

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY // Set your OpenAI API key in environment variables
});

// Function to get recommendations from OpenAI based on symptoms
async function getRecommendationsFromOpenAI(symptoms) {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system", 
          content: "You are a helpful health assistant. Provide basic health advice and recommendations for common symptoms. Always include disclaimer that this is not medical advice and serious symptoms should be evaluated by a doctor."
        },
        {
          role: "user",
          content: `I have the following symptoms: ${symptoms}. What could this be and what should I do?`
        }
      ],
      max_tokens: 200,
      temperature: 0.7,
    });
    
    return completion.choices[0].message.content;
  } catch (error) {
    console.error("OpenAI API error:", error);
    return "I'm sorry, I'm having trouble processing your symptoms right now. Please try again later or consult with a healthcare professional.";
  }
}

const LaunchRequestHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest';
  },
  handle(handlerInput) {
    const speakOutput = 'Welcome to Health Companion. You can tell me your symptoms, and I will provide some basic information. What symptoms are you experiencing today?';
    return handlerInput.responseBuilder
      .speak(speakOutput)
      .reprompt(speakOutput)
      .getResponse();
  }
};

const SymptomIntentHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
      && Alexa.getIntentName(handlerInput.requestEnvelope) === 'SymptomIntent';
  },
  async handle(handlerInput) {
    const symptom = handlerInput.requestEnvelope.request.intent.slots.symptom.value;
    
    if (!symptom) {
      return handlerInput.responseBuilder
        .speak("I didn't catch that. What symptoms are you experiencing?")
        .reprompt("Please tell me what symptoms you're having.")
        .getResponse();
    }
    
    // Get recommendation from OpenAI
    const recommendation = await getRecommendationsFromOpenAI(symptom);
    
    const speakOutput = `For your symptom of ${symptom}, here's what I found: ${recommendation}`;
    
    return handlerInput.responseBuilder
      .speak(speakOutput)
      .reprompt("Do you have any other symptoms you'd like me to check?")
      .getResponse();
  }
};

const MultipleSymptomIntentHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
      && Alexa.getIntentName(handlerInput.requestEnvelope) === 'MultipleSymptomIntent';
  },
  async handle(handlerInput) {
    const symptoms = handlerInput.requestEnvelope.request.intent.slots.symptoms.value;
    
    if (!symptoms) {
      return handlerInput.responseBuilder
        .speak("I didn't catch that. What symptoms are you experiencing?")
        .reprompt("Please tell me what symptoms you're having.")
        .getResponse();
    }
    
    // Get recommendation from OpenAI
    const recommendation = await getRecommendationsFromOpenAI(symptoms);
    
    const speakOutput = `Based on your symptoms: ${symptoms}, here's what I found: ${recommendation}`;
    
    return handlerInput.responseBuilder
      .speak(speakOutput)
      .reprompt("Is there anything else you'd like to know?")
      .getResponse();
  }
};

const HelpIntentHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
      && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.HelpIntent';
  },
  handle(handlerInput) {
    const speakOutput = 'You can tell me your symptoms by saying phrases like "I have a headache" or "I\'m experiencing fever and chills". I\'ll provide some basic health information. How can I help you today?';

    return handlerInput.responseBuilder
      .speak(speakOutput)
      .reprompt(speakOutput)
      .getResponse();
  }
};

const CancelAndStopIntentHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
      && (Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.CancelIntent'
        || Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.StopIntent');
  },
  handle(handlerInput) {
    const speakOutput = 'Thank you for using Health Companion. Remember, for serious health concerns, please consult with a healthcare professional. Goodbye!';

    return handlerInput.responseBuilder
      .speak(speakOutput)
      .getResponse();
  }
};

const FallbackIntentHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
      && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.FallbackIntent';
  },
  handle(handlerInput) {
    const speakOutput = "I'm sorry, I didn't understand that. You can tell me your symptoms by saying something like 'I have a headache' or 'I'm experiencing fever'. How can I help you?";

    return handlerInput.responseBuilder
      .speak(speakOutput)
      .reprompt(speakOutput)
      .getResponse();
  }
};

const SessionEndedRequestHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === 'SessionEndedRequest';
  },
  handle(handlerInput) {
    console.log(`~~~~ Session ended: ${JSON.stringify(handlerInput.requestEnvelope)}`);
    return handlerInput.responseBuilder.getResponse();
  }
};

const ErrorHandler = {
  canHandle() {
    return true;
  },
  handle(handlerInput, error) {
    const speakOutput = 'Sorry, I had trouble processing your request. Please try again.';
    console.log(`~~~~ Error handled: ${JSON.stringify(error)}`);

    return handlerInput.responseBuilder
      .speak(speakOutput)
      .reprompt(speakOutput)
      .getResponse();
  }
};

const SkillBuilder = SkillBuilders.custom()
  .addRequestHandlers(
    LaunchRequestHandler,
    SymptomIntentHandler,
    MultipleSymptomIntentHandler,
    HelpIntentHandler,
    CancelAndStopIntentHandler,
    FallbackIntentHandler,
    SessionEndedRequestHandler
  )
  .addErrorHandlers(
    ErrorHandler
  );

const skill = SkillBuilder.create();
const adapter = new ExpressAdapter(skill, false, false);

app.post('/alexa', adapter.getRequestHandlers());

app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});