const TENOR_KEY = 'LIVDSRZULELA';
const TENOR_BASE = 'https://g.tenor.com/v1';

export async function searchGifs(query, limit = 24) {
  const url = query.trim()
    ? `${TENOR_BASE}/search?key=${TENOR_KEY}&q=${encodeURIComponent(query)}&limit=${limit}&media_filter=minimal`
    : `${TENOR_BASE}/trending?key=${TENOR_KEY}&limit=${limit}&media_filter=minimal`;
  
  const res = await fetch(url);
  const json = await res.json();
  
  return (json.results || []).map(g => {
    const media = g.media[0];
    return {
      id: g.id,
      title: g.title || 'GIF',
      preview: media?.nanogif?.url || media?.tinygif?.url || media?.gif?.preview,
      url: media?.gif?.url,
      width: media?.gif?.dims?.[0] || 200,
      height: media?.gif?.dims?.[1] || 200,
    };
  });
}

export async function uploadToCatbox(file) {
  const form = new FormData();
  form.append('reqtype', 'fileupload');
  form.append('fileToUpload', file);
  const res = await fetch('https://catbox.moe/user/api.php', {
    method: 'POST',
    body: form,
  });
  return await res.text();
}
