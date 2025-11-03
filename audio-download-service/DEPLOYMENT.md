# Audio Download Service - Deployment Guide

## Current Production Deployment

**Service**: Multi-strategy audio/video download (yt-dlp + Soulseek P2P)
**Platform**: Akash Network (Decentralized Cloud)
**Version**: v2.2.0
**Endpoint**: https://ks0q2dcfot8rd3vje7s8nds5ok.ingress.europlots.com

### Health Check

```bash
curl https://ks0q2dcfot8rd3vje7s8nds5ok.ingress.europlots.com/health
```

**Expected Response**:
```json
{
  "status": "healthy",
  "service": "audio-download-service",
  "version": "2.2.0",
  "downloads_dir": "/tmp/slsk-downloads",
  "soulseek_configured": true,
  "strategies": [
    "yt-dlp",
    "soulseek-p2p",
    "yt-dlp-tiktok"
  ]
}
```

---

## Docker Image

**Repository**: `t3333chn0000/audio-download-service`
**Latest Tag**: `v2.2.0`
**Docker Hub**: https://hub.docker.com/r/t3333chn0000/audio-download-service

### Pull Image
```bash
docker pull t3333chn0000/audio-download-service:v2.2.0
```

---

## Akash Deployment

### Prerequisites
- Akash CLI installed (`provider-services`)
- Wallet with AKT tokens
- SDL file: `deploy-akash.yaml`

### Deploy to Akash

1. **Create deployment**:
```bash
provider-services tx deployment create deploy-akash.yaml --from mykey --keyring-backend test
```

2. **Check bids**:
```bash
provider-services query market bid list --owner <your-address>
```

3. **Accept bid** (choose provider):
```bash
provider-services tx market lease create \
  --dseq <deployment-sequence> \
  --gseq 1 --oseq 1 \
  --provider <provider-address> \
  --from mykey --keyring-backend test
```

4. **Get lease status**:
```bash
provider-services lease-status \
  --dseq <deployment-sequence> \
  --from mykey --keyring-backend test
```

5. **Check logs**:
```bash
provider-services lease-logs \
  --dseq <deployment-sequence> \
  --gseq 1 --oseq 1 \
  --from mykey --keyring-backend test
```

### Current Deployment

**Deployment Sequence**: Check Akash console
**Provider**: `europlots.com`
**Ingress URL**: `ks0q2dcfot8rd3vje7s8nds5ok.ingress.europlots.com`

**Resources**:
- CPU: 2 cores
- Memory: 4 GB
- Storage: 30 GB (for downloads)

**Cost**: ~$0.01-0.03/hour (~$7-22/month)

---

## Local Development

### Run Locally
```bash
cd audio-download-service
bun install
SOULSEEK_ACCOUNT=xxx SOULSEEK_PASSWORD=xxx bun start
```

### Build Docker Image
```bash
./build-and-push.sh
```

This will:
- Build image for v2.2.0
- Tag as `latest`
- Push to Docker Hub
- Update `deploy-akash.yaml`

---

## Configuration

### Environment Variables

**Required**:
- `SOULSEEK_ACCOUNT` - Soulseek P2P username
- `SOULSEEK_PASSWORD` - Soulseek P2P password
- `DATABASE_URL` - Neon PostgreSQL connection string

**Optional**:
- `PORT` - Service port (default: 3001)
- `DOWNLOADS_DIR` - Temp downloads (default: /tmp/slsk-downloads)
- `NEON_PROJECT_ID` - Neon project ID
- `ACOUSTID_API_KEY` - AcoustID verification API key
- `CHAIN_ID` - Grove chain ID (default: 37111 = Lens)

### SSL/TLS Configuration

**v2.2.0 includes SSL fix**:
- Updates ca-certificates FIRST before other packages
- Fixes HTTPS download issues (yt-dlp, Grove uploads)
- Works on all servers (no more SSL errors!)

---

## API Endpoints

### POST /download-and-store
Download audio track, verify with AcoustID, upload to Grove, update database.

**Fire-and-forget**: Returns immediately, processes asynchronously.

**Request**:
```json
{
  "spotify_track_id": "0vGsFFCP4Z1GNXpZmSMfhf",
  "expected_title": "All Falls Down",
  "expected_artist": "Kanye West",
  "acoustid_api_key": "I9UjOdbcJK",
  "chain_id": 37111
}
```

**Response**:
```json
{
  "status": "processing",
  "workflow_id": "0vGsFFCP4Z1GNXpZmSMfhf"
}
```

### POST /download-tiktok-video
Download TikTok video and upload to Grove.

**Request**:
```json
{
  "video_id": "7334542274145454891",
  "tiktok_url": "https://www.tiktok.com/@username/video/7334542274145454891",
  "chain_id": 37111
}
```

**Response**:
```json
{
  "success": true,
  "video_id": "7334542274145454891",
  "grove_cid": "5d85ca354afb...",
  "grove_url": "https://api.grove.storage/5d85ca354afb...",
  "download_method": "yt-dlp-tiktok"
}
```

### GET /health
Health check endpoint.

---

## Monitoring

### Check Service Health
```bash
curl https://ks0q2dcfot8rd3vje7s8nds5ok.ingress.europlots.com/health
```

### Monitor Logs (Akash)
```bash
provider-services lease-logs --dseq <deployment-seq> --from mykey
```

### Database Monitoring
Check `song_audio` and `tiktok_videos` tables for Grove URLs:

```sql
-- Check recent downloads
SELECT spotify_track_id, grove_url, download_method, created_at
FROM song_audio
ORDER BY created_at DESC
LIMIT 10;

-- Check TikTok videos
SELECT video_id, grove_video_url, grove_uploaded_at
FROM tiktok_videos
WHERE grove_video_cid IS NOT NULL
ORDER BY grove_uploaded_at DESC
LIMIT 10;
```

---

## Troubleshooting

### Service Not Responding
1. Check Akash deployment status
2. Verify ingress URL is correct
3. Check provider logs for errors

### SSL/TLS Errors
- v2.2.0 includes SSL fix
- If issues persist, try different Akash provider
- Check ca-certificates are updated in Dockerfile

### Downloads Failing
1. Check yt-dlp is working: Test manually in container
2. Verify Soulseek credentials are valid
3. Check network connectivity from Akash provider

### Grove Upload Failures
1. Verify Grove API is accessible
2. Check file size limits
3. Ensure chain_id is correct (37111 for Lens)

---

## Upgrade Procedure

1. **Update code** in `index.ts`
2. **Bump version** in `package.json`
3. **Build and push** Docker image:
   ```bash
   ./build-and-push.sh
   ```
4. **Update `deploy-akash.yaml`** with new version tag
5. **Redeploy to Akash**:
   ```bash
   provider-services tx deployment update deploy-akash.yaml \
     --dseq <deployment-seq> --from mykey
   ```

---

## Rollback

If v2.2.0 has issues, rollback to v2.1.1:

1. Update `deploy-akash.yaml`:
   ```yaml
   image: t3333chn0000/audio-download-service:v2.1.1
   ```

2. Redeploy:
   ```bash
   provider-services tx deployment update deploy-akash.yaml \
     --dseq <deployment-seq> --from mykey
   ```

---

## Cost Analysis

**Akash Deployment** (current):
- Hourly: ~$0.01-0.03
- Monthly: ~$7-22
- Cheaper than AWS/GCP by 3-10x

**Alternatives**:
- RunPod: ~$0.10/hour (~$73/month) - No P2P support
- Render: ~$7/month - Limited resources
- AWS EC2 t3.medium: ~$30/month

**Recommendation**: Keep on Akash for cost + decentralization benefits!

---

## Security Notes

- Soulseek credentials stored in Akash deployment (encrypted)
- Database URL exposed via env (use connection pooling)
- No authentication on endpoints (internal use only)
- Fire-and-forget prevents DDoS amplification

---

## Related Services

- **karaoke-pipeline**: Orchestrates downloads via this service
- **quansic-service**: ISWC discovery (also on Akash)
- **demucs-modal**: Audio separation (Modal/RunPod)
- **Grove/IPFS**: Permanent storage for audio/video

---

## Support

**Issues**: Create issue in monorepo
**Logs**: Check Akash provider logs
**Status**: https://ks0q2dcfot8rd3vje7s8nds5ok.ingress.europlots.com/health
