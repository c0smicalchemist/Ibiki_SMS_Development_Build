## How To Provide The Docs
- I can OCR images (PNG/JPG) and plain text. If your docs are only in PDF:
  - Option A: Take screenshots of each PDF page and attach them (PNG/JPG)
  - Option B: Copy/paste the text from the PDF into the chat
  - Option C: Use any PDF-to-image tool and attach the converted images

## What I Will Extract (once received)
- Connection: SMPP port, bind mode, enquire_link interval, window size/TPS
- Addressing: TON/NPI for source/destination; sender rules
- Encoding: GSM7/UCS2 mapping to `data_coding`
- Long SMS: segmentation method (UDH/SAR TLVs), max segment sizes
- DLR: registered_delivery flags, status mapping, message ID format/correlation
- MO: deliver_sm field mapping
- Optional HTTP callbacks for DLR/MO

## Implementation Plan (after OCR)
1. Provider abstraction (`Provider`, `ProviderManager`) to switch HTTP ↔ SMPP globally and per-group
2. `SmppProvider` adapter: bind, submit_sm, deliver_sm (DLR/MO), encoding, long SMS segmentation, TPS windowing
3. Admin UI: provider toggle and SMPP settings (host, port, system_id, password, TON/NPI, enquire_link, bind mode), plus “Test SMPP”
4. Route sends via adapter; keep normalization and 1-credit deduction unchanged; unify logging
5. DLR/MO persistence and inbox routing; optional HTTP callback endpoints if vendor supports
6. Health metrics and a status endpoint; graceful reconnect/shutdown

## Verification
- Bind/connectivity test
- GSM7/UCS2/long SMS test messages
- DLR state transitions and MO inbox threads

Send the screenshots or paste the text and I will OCR/translate and return the fully detailed plan with all vendor-specific values before any code changes.