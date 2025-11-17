# Inventory Management System repository (SupplyNet)

This is the main repository for the Inventory Management System project, developed for use by the Massachussetts National Guard.

### Overview of Project

The project does X Y Z

### Development Context

##### Authorship

The code in this project was developed in Northeastern University's inaugural CS4535 class, taught by Dr. Mark Fontenot and Dr. Wendy Truran.  Our team includes PM Diego Cicotiste, backend developers Reese Cantu, Steph Sayegh, and Lily Bedichek, and frontend develpoers Tyler Goldener and Ben Tran.  Our military associate / client was Sgt. Paul Martin, State Innovation Officer and member of the 387th Explosive Ordinance Disposal Company. We partially included information from a document developed by a Tuft's ENP 0074 capstone class in Spring of 2025.  

##### Scope and Limitations

Our job is to create a web-based application for use by inventory-taking technicians which will produce appropriate supply forms. We are working with a $50/month AWS budget and a limited bandwidth team.  We are not automating the entire inventory process, only the frontend section done by military technicians. Xyz

## Architecture

diagram 

### Database setup

diagram

### File layout

where to find x in y z

# SECTION FOR DIEGO TO DO 

### How to run/deploy/test the project for the first time

### How to run/deploy/test the project subsequent times

### How to change credentials

# Old code (may be useful)

### Install everything

```bash
npm install
npm run test
npm run dev
npm run start
```


# make sure you are in node 20

# install nvm (if you don’t have it)

brew install nvm
mkdir -p ~/.nvm
echo 'export NVM_DIR="$HOME/.nvm"' >> ~/.zshrc
echo '[ -s "/opt/homebrew/opt/nvm/nvm.sh" ] && . "/opt/homebrew/opt/nvm/nvm.sh"' >> ~/.zshrc
source ~/.zshrc

# install & use Node 20 (LTS)

nvm install 20
nvm use 20
nvm alias default 20

---

npm i -g aws-cdk

one-time cdk bootstrap aws://<ACCOUNT>/<REGION>

CDK
cd src/cdk
cdk bootstrap aws://YOUR_ACCOUNT/YOUR_REGION

STEPS:

# from root/

nvm use # uses Node 20 per .nvmrc
npm i # installs all workspace deps

# dev (frontend + api)

npm run dev # http://localhost:5173 (frontend), http://localhost:3001 (api)

# run everything (frontend + api + cdk TS watch)

npm run dev:all

# CDK (deploy infra when ready)

npm run build -w src/cdk
npm run synth -w src/cdk
npm run deploy -w src/cdk
