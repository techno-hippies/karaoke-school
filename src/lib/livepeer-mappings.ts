/**
 * Mapping of Irys transaction IDs to Livepeer playback IDs
 * Generated from the dual upload process
 */
export const irysToLivepeer: Record<string, string> = {
  // Latest upload with both Irys + Livepeer (from dual upload)
  // @17d34
  "FbcrJFfF1rYzT8vPbrsbaRbwQBwhR86Gp7wp9Nt9Hkdp": "c868nufjt1u4fjnk",
  "9NRdm2MbTLP32E43bVjPB1C93iDTJPpEXxtoNqd926zr": "6fc3m3n5wlfmexmu",
  "CjeeMGmaUv32P3tYrtFAgq3A9mnkTC8zkC9FJS7kyqu1": "45e2j4f40xhb1l6t",
  
  // @ad1yn22
  "AcfoRBRzYjEdDAdWW8AnBpLBqJod1CBti2qDAhmKKjyP": "20e51vo65rb18sei",
  "HTicRcFZE4grTc6AmWgbmGp99kgTk26PGt75U9kqwDjm": "9567xt0x5h87pw50",
  "4uE7zXvbkPstLVn2vARA7jtdbSX57a6XuLVKoGrh4Epd": "027b75xq71kr7jqo",
  
  // @addisonre
  "4yMue4zFHYAmgFUkyYTenSa3DQhwNzbAo9nE4BdePACG": "1c83hcd7l9udc6zx",
  "Ab9tv3ukmNtU7o8BW9mQieLM4HQKrmNuFBMwaBX2eKyk": "88d2m7m39xk9iw9j",
  "HduG5t3AK4fsHvnXqw8qs4r8MDoxFTLkL2ZtiNBCqBXV": "0a07witjsy0h7hul",
  
  // Old uploads (Irys only, no Livepeer) - these won't play video properly
  // but we map them to prevent errors
  "6L7nSH1iB3CsN5HfeMTYwhQenmPyEPyVoPMhfFnMoWJX": "",
  "2xi5FNfFz8wCXiodrG8htRZFA5UXg8BdmWQMG6QnbjFx": "",
  "DxkaBu1zDhL2ujuFpFh9QrpkZbWispdDbzt332H9DNXH": "",
  "A4RtokDq9tpUafrq3MMkJVwKyH9UMe11psNb2WCqFMDM": "",
  "7PtN74TKh3emWzNM2ZEVAGhzJFWwC3LWkJ65WbLVSWqf": "",
  "7ALzSSNcxwfGnRAi1KBWiYN3Ev6HEhwvhR5AmcRWErLD": "",
  "4u27pfZRvchaF6X8GvWMgGNUQmLbtFPysxuSaTpePuok": "",
  "EFyV7pCjLvX3TTMXMZWpWQf43kLoSZ4kb2r4yJ22vFH5": "",
  "E4UJN8t6uqCnhmb2k5k5PhAANyuGoRG7yydWyzqRZLuY": "",
  "6tSvdSQTKTjTBsPTvm2NjsAseyuQ5sTCyTwp3skx7ZVx": "",
  "DeDZxpaASH1vCwrhSQsF7wJAWj6LotjoBrMFrqWSbzoA": "",
  "Fszn6Jxr3YCTPMFrNR6A178CRqAZXg3Bjp5Mbgtq2VtN": "",
};

/**
 * Get Livepeer streaming URL from Irys transaction ID
 */
export function getLivepeerUrl(irysId: string): string {
  const playbackId = irysToLivepeer[irysId];
  if (playbackId) {
    // Use the correct Livepeer CDN URL format from the API
    return `https://vod-cdn.lp-playback.studio/raw/jxf4iblf6wlsyor6526t4tcmtmqa/catalyst-vod-com/hls/${playbackId}/index.m3u8`;
  }
  // Fallback to Irys URL if no mapping exists
  return `https://gateway.irys.xyz/${irysId}`;
}