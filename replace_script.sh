#!/bin/bash
find . -type f -not -path "*/node_modules/*" -not -path "*/.next/*" -not -path "*/.git/*" -exec perl -pi -e '
s/Corevow Limited/Corevow Limited/gi;
s/Corevow LLC/Corevow LLC/gi;
s/Corevow Billing Hub/Corevow Billing Hub/gi;
s/\@app\.com/\@corevow.com/gi;
s/www\.app\.com/www.corevow.com/gi;
s/Corevow logo/Corevow logo/gi;
s/Corevow logo/Corevow Logo/gi;
s/#100e09/#100e09/gi;
s/#f5f4eb/#f5f4eb/gi;
s/#f5f4eb/#f5f4eb/gi;
s/logos\/Corevow logo\.svg/logos\/SVG\/corevow-logo.svg/gi;
' {} +
