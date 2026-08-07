const aiService = require('../src/services/aiService');

describe('aiService OpenRouter & Gemini Hybrid Routing Integration', () => {
  let originalFetch;

  beforeAll(() => {
    originalFetch = global.fetch;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  test('should call OpenRouter API for text-only messages', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              role: 'assistant',
              content: '喵嗚～ 我是雲喵！使用 DeepSeek V4 Flash 為你服務喔！😼💙'
            }
          }
        ]
      })
    });

    const contextUser = { id: '123456789', username: 'testuser', displayName: '測試玩家' };
    const response = await aiService.generateAiResponse('你好，介紹一下你自己！', contextUser, [], 'channel-text-only');

    expect(global.fetch).toHaveBeenCalled();
    const fetchArgs = global.fetch.mock.calls[0];
    expect(fetchArgs[0]).toBe('https://openrouter.ai/api/v1/chat/completions');
    
    const body = JSON.parse(fetchArgs[1].body);
    expect(body.model).toBe('deepseek/deepseek-v4-flash-0731');
    expect(response).toContain('我是雲喵');
  });

  test('should parse and include text file attachments (.py, .js, .txt) in the prompt', async () => {
    global.fetch = jest.fn().mockImplementation(async (url) => {
      if (url.includes('script.py')) {
        return Promise.resolve({
          ok: true,
          arrayBuffer: async () => Buffer.from('print("Hello from Python script")')
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                role: 'assistant',
                content: '這段 Python 程式碼會印出 Hello 訊息喵！'
              }
            }
          ]
        })
      });
    });

    const contextUser = { id: '123456789', username: 'testuser', displayName: '測試玩家' };
    const attachments = [{ url: 'https://cdn.discordapp.com/attachments/123/456/script.py', name: 'script.py', contentType: 'text/x-python' }];

    const response = await aiService.generateAiResponse('幫我看這個檔內容', contextUser, attachments, 'channel-file-test');

    expect(global.fetch).toHaveBeenCalled();
    const openrouterCall = global.fetch.mock.calls.find(c => c[0].includes('openrouter.ai'));
    expect(openrouterCall).toBeDefined();
    
    const body = JSON.parse(openrouterCall[1].body);
    const userMsg = body.messages.find(m => m.role === 'user');
    expect(userMsg.content).toContain('script.py');
    expect(userMsg.content).toContain('print("Hello from Python script")');
    expect(response).toContain('這段 Python 程式碼');
  });

  test('should route to Gemini 2.5 Flash when image attachments are present', async () => {
    global.fetch = jest.fn().mockImplementation(async (url) => {
      if (url.includes('image.png')) {
        return Promise.resolve({
          ok: true,
          arrayBuffer: async () => Buffer.from('fake-image-bytes')
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: '哇！這是一隻超級可愛的貓貓圖片喵！' }]
              }
            }
          ]
        })
      });
    });

    const contextUser = { id: '123456789', username: 'testuser', displayName: '測試玩家' };
    const attachments = [{ url: 'https://cdn.discordapp.com/attachments/123/456/image.png', contentType: 'image/png' }];
    
    const response = await aiService.generateAiResponse('你看這張圖片！', contextUser, attachments, 'channel-image-test');

    expect(global.fetch).toHaveBeenCalled();
    const geminiCall = global.fetch.mock.calls.find(c => c[0].includes('generativelanguage.googleapis.com'));
    expect(geminiCall).toBeDefined();
    expect(response).toContain('可愛的貓貓圖片');
  });

  test('should handle tool calls correctly with OpenRouter', async () => {
    let callCount = 0;
    global.fetch = jest.fn().mockImplementation(async (url, options) => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            choices: [
              {
                message: {
                  role: 'assistant',
                  tool_calls: [
                    {
                      id: 'call_joke_1',
                      type: 'function',
                      function: {
                        name: 'get_random_joke',
                        arguments: '{}'
                      }
                    }
                  ]
                }
              }
            ]
          })
        });
      } else {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            choices: [
              {
                message: {
                  role: 'assistant',
                  content: '這裡有一個冷笑話喵！'
                }
              }
            ]
          })
        });
      }
    });

    const contextUser = { id: '123456789', username: 'testuser', displayName: '測試玩家' };
    const response = await aiService.generateAiResponse('講個笑話吧', contextUser, [], 'channel-tool-test');

    expect(callCount).toBe(2);
    expect(response).toBe('這裡有一個冷笑話喵！');
  });
});
