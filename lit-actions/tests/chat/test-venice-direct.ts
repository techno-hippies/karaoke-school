#!/usr/bin/env bun

/**
 * Direct Venice API Test - No Lit Protocol
 *
 * Tests Venice AI API directly before integrating with Lit Actions
 *
 * Usage:
 *   VENICE_API_KEY=xxx bun tests/chat/test-venice-direct.ts
 */

const VENICE_API_URL = 'https://api.venice.ai/api/v1/chat/completions';
const VENICE_MODEL = 'qwen3-4b';

const SCARLETT_SYSTEM_PROMPT = `你是Scarlett（思嘉），一位友善且耐心的英语老师。你的职责是帮助中文母语者学习英语。

你的教学风格：
- 主要用中文和学生交流，让他们感到舒适
- 在教授英语词汇或句子时，提供中文翻译和解释
- 鼓励学生多说英语，但不要强迫
- 纠正错误时要温柔，解释为什么这样说更好
- 使用简单易懂的例句
- 当学生说得好时，给予真诚的鼓励

当学生用中文问你问题时，用中文回答。
当学生尝试说英语时，用中文给予反馈和纠正。
如果学生想练习对话，你可以用简单的英语和他们交流，同时提供中文解释。

保持对话轻松愉快，就像朋友聊天一样！`;

async function testChat() {
  const apiKey = process.env.VENICE_API_KEY;

  if (!apiKey) {
    console.error('❌ VENICE_API_KEY environment variable is required');
    process.exit(1);
  }

  console.log('🤖 Venice AI Direct Test\n');
  console.log('Model:', VENICE_MODEL);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Test 1: Chat
  console.log('📝 TEST 1: CHAT MODE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const userMessage = '你好！我想学英语，应该从哪里开始？';
  console.log('📤 User:', userMessage);
  console.log('');

  const chatStartTime = Date.now();

  const chatResponse = await fetch(VENICE_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: VENICE_MODEL,
      messages: [
        { role: 'system', content: SCARLETT_SYSTEM_PROMPT },
        { role: 'user', content: userMessage }
      ],
      max_tokens: 1024,
      temperature: 0.7,
      venice_parameters: {
        include_venice_system_prompt: false,
        strip_thinking_response: true,
        disable_thinking: true
      }
    })
  });

  const chatTime = Date.now() - chatStartTime;

  if (!chatResponse.ok) {
    const errorText = await chatResponse.text();
    console.error('❌ Chat API Error:', chatResponse.status, errorText);
    process.exit(1);
  }

  const chatData = await chatResponse.json();
  const reply = chatData.choices[0].message.content;

  console.log('📥 Scarlett:', reply);
  console.log('');
  console.log('⏱️  Time:', chatTime, 'ms');
  console.log('📊 Tokens:', chatData.usage?.total_tokens || 'N/A');

  // Test 2: Translate
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📝 TEST 2: TRANSLATE MODE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const textToTranslate = "Hello! I am Scarlett, your English tutor. Let's learn together!";
  console.log('📤 English:', textToTranslate);
  console.log('');

  const translateStartTime = Date.now();

  const translateResponse = await fetch(VENICE_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: VENICE_MODEL,
      messages: [
        {
          role: 'system',
          content: '你是一个专业的英中翻译。将英文准确翻译成自然流畅的中文。只输出翻译结果，不要添加任何解释。'
        },
        {
          role: 'user',
          content: `请将以下英文翻译成中文：\n\n${textToTranslate}`
        }
      ],
      max_tokens: 512,
      temperature: 0.3,
      venice_parameters: {
        include_venice_system_prompt: false,
        strip_thinking_response: true,
        disable_thinking: true
      }
    })
  });

  const translateTime = Date.now() - translateStartTime;

  if (!translateResponse.ok) {
    const errorText = await translateResponse.text();
    console.error('❌ Translate API Error:', translateResponse.status, errorText);
    process.exit(1);
  }

  const translateData = await translateResponse.json();
  const translation = translateData.choices[0].message.content;

  console.log('📥 Chinese:', translation);
  console.log('');
  console.log('⏱️  Time:', translateTime, 'ms');
  console.log('📊 Tokens:', translateData.usage?.total_tokens || 'N/A');

  // Test 3: Multi-turn conversation
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📝 TEST 3: MULTI-TURN CONVERSATION');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const conversationHistory = [
    { role: 'system', content: SCARLETT_SYSTEM_PROMPT },
    { role: 'user', content: '你好！' },
    { role: 'assistant', content: '你好！我是Scarlett，很高兴认识你！今天想学什么英语呢？' },
    { role: 'user', content: '我想学怎么说"谢谢"' }
  ];

  console.log('📤 Conversation:');
  conversationHistory.slice(1).forEach(msg => {
    const role = msg.role === 'user' ? '👤 User' : '🤖 Scarlett';
    console.log(`   ${role}: ${msg.content.substring(0, 50)}${msg.content.length > 50 ? '...' : ''}`);
  });
  console.log('');

  const multiTurnStartTime = Date.now();

  const multiTurnResponse = await fetch(VENICE_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: VENICE_MODEL,
      messages: conversationHistory,
      max_tokens: 1024,
      temperature: 0.7,
      venice_parameters: {
        include_venice_system_prompt: false,
        strip_thinking_response: true,
        disable_thinking: true
      }
    })
  });

  const multiTurnTime = Date.now() - multiTurnStartTime;

  if (!multiTurnResponse.ok) {
    const errorText = await multiTurnResponse.text();
    console.error('❌ Multi-turn API Error:', multiTurnResponse.status, errorText);
    process.exit(1);
  }

  const multiTurnData = await multiTurnResponse.json();
  const multiTurnReply = multiTurnData.choices[0].message.content;

  console.log('📥 Scarlett:', multiTurnReply);
  console.log('');
  console.log('⏱️  Time:', multiTurnTime, 'ms');
  console.log('📊 Tokens:', multiTurnData.usage?.total_tokens || 'N/A');

  // Summary
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ ALL TESTS PASSED!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('📊 Summary:');
  console.log('   Chat response time:', chatTime, 'ms');
  console.log('   Translate response time:', translateTime, 'ms');
  console.log('   Multi-turn response time:', multiTurnTime, 'ms');
  console.log('');
  console.log('💡 Venice AI is working correctly!');
  console.log('   Next: Encrypt API key and integrate with Lit Actions');
}

testChat().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
