import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async () => {
  // Sample Estonian text with various entities for testing
  const sampleText = `
    Tallinna Ülikooli rektor Tiit Land ja Tartu Ülikooli professor Mart Kull 
    kohtusid Eesti Teaduste Akadeemias. Nad arutasid koostööd tehisintellekti 
    valdkonnas. Kohtumisel osales ka Microsoft Eesti juht Kalle Palling.
    
    Tallinnas toimub rahvusvaheline konverents "Digitaalne Transformatsioon 2024".
    Konverentsil esineb ka Soome ekspert Jukka Mäkeläinen.
  `;

  try {
    // Call our NER endpoint
    const response = await fetch('http://localhost:5173/api/tools/ner', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: sampleText,
        language: 'et'
      })
    });

    if (!response.ok) {
      throw new Error(`NER API responded with status: ${response.status}`);
    }

    const result = await response.json();
    
    return json({
      success: true,
      sampleText,
      nerResult: result,
      message: 'NER test completed successfully'
    });

  } catch (error) {
    console.error('Error testing NER API:', error);
    return json({
      success: false,
      sampleText,
      message: 'Failed to test NER API',
      error: error.message
    }, { status: 500 });
  }
}; 