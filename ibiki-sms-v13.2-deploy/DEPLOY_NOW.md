# Deploy Ibiki SMS - EXACT COMMANDS

## You're at: `/root/deploy-temp#`

The ZIP extracted to `IbikiGateway` folder. Here's what to do:

```bash
# You're here: /root/deploy-temp
# Enter the IbikiGateway folder
cd IbikiGateway

# Now you're here: /root/deploy-temp/IbikiGateway
# Verify deploy.sh is here
ls -la deploy.sh

# Make it executable and run
chmod +x deploy.sh
sudo ./deploy.sh
```

That's it!

---

## If deploy.sh is not there:

```bash
# Find it
find /root -name "deploy.sh"

# It will show you where it is, then cd there
```

---

## After deployment:

Visit: `http://151.243.109.79:3100`
