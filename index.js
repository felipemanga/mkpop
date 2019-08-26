
const TagType = [
    
    "PADDING",
    "INDEX",
    "OFFSETADDRESS",
    "CODECHUNK",
    "ENTRYPOINT",
    "CRC",
    "HAT",
    "LONGNAME",
    "AUTHOR",
    "DESCRIPTION",
    "IMG_36X36_4BPP",
    "IMG_24X24_4BPP",
    "IMG_100X24_4BPP",
    "IMG_110X88_4BPP",

    "IMG_36X36_565",
    "IMG_24X24_565",
    "IMG_100X24_565",
    "IMG_110X88_565",

    "IMG_220X176_565",

    "IMG_200X80_4BPP",
    "IMG_200X80_565",
    "VERSION"
    
].reduce( (obj, v, i) => {
    obj[v] = i;
    return obj;
}, {} );

TagType.CODE = 0x10008000;

const palette = [
    0x181c20,
    0x4a5052,
    0xa4a19c,
    0xffffff,
    0x202c9c,
    0x5255ff,
    0x08a18b,
    0x39b2de,
    0x8b20ac,
    0xf691a4,
    0xa42010,
    0xff8518,
    0xffde39,
    0x734429,
    0x527d10,
    0x83ce18,
];

const tmpab32 = new Int32Array(1);
const tmpab8 = new Int8Array( tmpab32.buffer );

function STR(s){
    return [
	...U32( s.length+1 ),
	...s.split("").map( s=>s.charCodeAt(0) ),
	0
    ];
}

function U32(n){
    tmpab32[0] = n;
    return tmpab8;
}

function append( arr, ...args ){
    let l = arr.length;

    for( let arg=0; arg<args.length; ++arg ){
        let src = args[arg];

        if( src ){
            if( src instanceof ArrayBuffer )
                src = new Uint8Array(src);

            if( Array.isArray(src) || src.buffer ){
                for( let i=0; i<src.length; ++i )
                    arr[l++] = src[i];
            }
            
        }
        
        if( typeof src == "string" ){
            append( arr, STR(src) );
            l = arr.length;
        }
        
        if( typeof src == "number" ){
            append( arr, U32(src) );
            l = arr.length;
        }

    }

    return arr;
}

const APP = {

    savePOP(){
        let pop = this.exportPOP();
        if( !pop )
            return;
        
        let url = URL.createObjectURL(
            new Blob([pop.buffer], {type:'application/bin'})
        );

        let a = document.createElement("a");
        a.href = url;
        a.download = DATA.fileName;
        
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        URL.revokeObjectURL(url);
        
    },

    exportPOP(){
        if( !DATA.bin )
            return null;

        let out = [];

        append( out, TagType.LONGNAME, DATA.title || "Game" );

        append( out, TagType.AUTHOR, DATA.author || "Anon" );

        append( out, TagType.VERSION, DATA.version || "v1.0.0" );

        append( out, TagType.DESCRIPTION, DATA.description || "Pokitto Game" );

        if( DATA.thumb24 ){

            let img = APP.img4bpp(
                TagType.IMG_24X24_4BPP,
                DATA.thumb24,
                24, 24
            );
            
            append( out, img );

            img = APP.img565(
                TagType.IMG_24X24_565,
                DATA.thumb24,
                24, 24
            );

            append( out, img );
        }

        if( DATA.thumb36 ){
            let img = APP.img4bpp(
                TagType.IMG_36X36_4BPP,
                DATA.thumb36,
                36, 36
            );
            
            append( out, img );

            img = APP.img565(
                TagType.IMG_36X36_565,
                DATA.thumb36,
                36, 36
            );

            append( out, img );
        }

        if( DATA.title100x24 ){
            let img = APP.img4bpp(
                TagType.IMG_100X24_4BPP,
                DATA.title100x24,
                100, 24
            );
            
            append( out, img );

            img = APP.img565(
                TagType.IMG_100X24_565,
                DATA.title100x24,
                100, 24
            );

            append( out, img );
        }

        if( DATA.title200x80 ){
            let img = APP.img4bpp(
                TagType.IMG_200X80_4BPP,
                DATA.title200x80,
                200, 80
            );
            
            append( out, img );

            img = APP.img565(
                TagType.IMG_200X80_565,
                DATA.title200x80,
                200, 80
            );

            append( out, img );
        }

        DATA.screenshot.forEach( imgEl => {
            let img = APP.img565( TagType.IMG_220X176_565, imgEl, 220, 176 );
            append( out, img );
        });
        
        append( out, DATA.bin );

        return new Uint8Array(out);

    },

    img565( tagType, image, w, h ){
        let out = [ ...U32(tagType), ...U32(w*h*2) ];
        
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage( image, 0, 0, w, h );
        const buf = ctx.getImageData(0, 0, w, h).data;

        for( let i=0; i<buf.length; i++ ){
            let r = buf[i++];
            let g = buf[i++];
            let b = buf[i++];
            r = (r/255.0)*0x1F<<11;
            g = (g/255.0)*0x3F<<5;
            b = (b/255.0)*0x1F;
            let c = r|g|b;
            out.push( c&0xFF );
            out.push( c>>>8 );
        }

        return out;
        
    },

    img4bpp( tagType, image, w, h ){

        let pal = [];

        for( let i=0; i<palette.length; ++i ){
            pal[i] = [
                (palette[i])&0xFF,
                (palette[i]>>>8)&0xFF,
                (palette[i]>>>16)&0xFF
            ];
        }

        
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage( image, 0, 0, w, h );
        const buf = ctx.getImageData(0, 0, w, h).data;
        const nerr = [0,0,0];
        const pixel = [0,0,0];
        const error = [0,0,0];
        const infl = [];

        for( let i=0; i<buf.length; ++i ){
	    let j;

	    nerr[2] = buf[i++];
	    nerr[1] = buf[i++];
	    nerr[0] = buf[i++];

	    pixel[0] = nerr[0] + error[0];
	    pixel[1] = nerr[1] + error[1];
	    pixel[2] = nerr[2] + error[2];

	    let minind = 0;
	    let mindist = (pixel[0]-pal[0][0])*(pixel[0]-pal[0][0]) +
	        (pixel[1]-pal[0][1])*(pixel[1]-pal[0][1]) +
	        (pixel[2]-pal[0][2])*(pixel[2]-pal[0][2]);

	    for( j=1; j<pal.length; ++j ){
	        let dist = (pixel[0]-pal[j][0])*(pixel[0]-pal[j][0]) +
		    (pixel[1]-pal[j][1])*(pixel[1]-pal[j][1]) +
		    (pixel[2]-pal[j][2])*(pixel[2]-pal[j][2]);

	        if( dist < mindist ){
		    minind = j;
		    mindist = dist;
		    if( dist == 0 )
		        break;
	        }
	    }
            /*
	      error[0] = nerr[0] - pal[minind][0];
	      error[1] = nerr[1] - pal[minind][1];
	      error[2] = nerr[2] - pal[minind][2];
            */
	    infl.push( minind );

        }

        const out = [...U32(tagType), ...U32((w>>1)*(h))];

        for( let i=0; i<infl.length; ){
	    let hi = infl[i++];
	    let lo = infl[i++];
	    out.push( (hi<<4) | lo );
        }
        
        return out;
    },
    
    onDropFile( event ){
        
        for( let i=0, file; (file=event.dataTransfer.files[i]); ++i ){
            let fr = new FileReader();
            fr.onload = APP.importFile.bind( APP, file.name, fr );
            fr.readAsArrayBuffer( file );
        }
        
    },

    takeScreenshot(){
        let ss = DOM.emulator.contentWindow.takeScreenshot();
        if( ss )
            APP.importFile( "screenshot.png", ss.buffer );
    },

    shortText( txt ){

        txt = decamel(txt);

        if( txt.length <= 7 )
            return txt;

        txt = txt.replace(/\([^)]*\)/g, "")
            .replace(/[^0-9a-z ]/gi, "")
            .replace(/\s+/g, ' ')
            .trim();

        txt = txt.split(" ");
        if( txt.length >= 3 ){
            txt = txt.map( x=>x[0] );
        }else if( txt.length > 1 ){
            txt = [txt[0][0].toUpperCase(), txt[1]];
        }
        txt = txt.join("");

        if( txt.length > 7 )
            txt = txt.substr(0, 6) + "...";

        
        return txt;

        function decamel( txt ){
            txt = txt.split(/([a-z][A-Z])/);
            for( let i=0; i<txt.length-1; i+=2 )
                txt[i+1] = txt[i+1][0] + " " + txt[i+1][1];
            return txt.join("");
        }
    },

    makePreview( data ){
        let canvas, width, height;
        let u32 = new Uint32Array( data );

        if( data instanceof HTMLCanvasElement ){
            canvas = data;
            width = canvas.width;
            height = canvas.height;
        }else{
            switch( u32[0] ){
            case TagType.IMG_24X24_4BPP: width=height=24; break;
            case TagType.IMG_36X36_4BPP: width=height=36; break;
            case TagType.IMG_100X24_4BPP: width=100; height=24; break;
            case TagType.IMG_110X88_4BPP: width=110; height=24; break;
            case TagType.IMG_200X80_4BPP: width=200; height=80; break;
            default: return null;
            }
            
            canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
        }

        let ctx = canvas.getContext("2d");
        let img = ctx.getImageData(0, 0, width, height);
        for( let i=8, j=0; i<data.length; ++i ){
            let b = data[i];
            let c;
            c = palette[b>>>4];
            img.data[j++] = (c>>>16)&0xFF;
            img.data[j++] = (c>>>8)&0xFF;
            img.data[j++] = (c)&0xFF;
            img.data[j++] = 0xFF;
            c = palette[b&0xF];
            img.data[j++] = (c>>>16)&0xFF;
            img.data[j++] = (c>>>8)&0xFF;
            img.data[j++] = (c)&0xFF;
            img.data[j++] = 0xFF;
        }

        ctx.putImageData( img, 0, 0 );

        let e = document.createElement("img");
        e.src = canvas.toDataURL();
        return e;
    },

    makeThumb( size, text ){
        if( !DATA.screenshot || !DATA.screenshot.length ){
            return APP.makeThumbText(size, text);
        }

        let full = DATA.screenshot[0];
        let fullHeight = full.naturalHeight || full.height;
        let fullWidth  = full.naturalWidth || full.width;
        
        let scale = size / fullHeight;
        let canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        let ctx = canvas.getContext("2d");
        ctx.scale(scale, scale);
        ctx.drawImage(full, fullHeight/2 - fullWidth/2, 0, fullWidth, fullHeight);
        
        let img = document.createElement("img");
        img.src = canvas.toDataURL();
        return img;
    },

    makeThumbText( size, text ){
        let canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;

        let ctx = canvas.getContext("2d");
        ctx.mozImageSmoothingEnabled = false;
        ctx.webkitImageSmoothingEnabled = false;

        let seed = 0;
        for( let i=0; i<text.length; ++i )
            seed += (seed >>> 15) ^ text.charCodeAt(i)*2987432;

        text = APP.shortText(text);

        let bgc = (seed & 0xF); seed >>= 4;
        let mgc = (seed & 0x3) + 8; seed >>= 2;
        let m2gc = (seed & 0x3) + 9; seed >>= 2;
        let fgc = (seed & 0x7); seed >>= 3;
        let f2gc = (seed & 0x7) + 8; seed >>= 3;

        ctx.font = (size*0.6|0) + "px 'Poor Story' ";

        ctx.fillStyle = '#' + palette[bgc].toString(16).padStart(6, "0");
        ctx.fillRect( 0, 0, size, size );
        if( text.length > 3 )
            ctx.rotate( -45 * Math.PI / 180 );
        else
            ctx.translate( size/2, -size/6 );
        
        ctx.fillStyle = '#' + palette[mgc].toString(16).padStart(6, "0");
        ctx.fillRect( -size/1.4|0, size/2.7|0, size*1.5|0, size/1.4|0 );
        
        ctx.fillStyle = '#' + palette[fgc].toString(16).padStart(6, "0");
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        ctx.lineWidth = 0.3;
        ctx.strokeStyle = '#' + palette[f2gc].toString(16).padStart(6, "0");
        for( let i=0; i<3; ++i )
            ctx.fillText( text, 0, size/1.45, size);

        ctx.strokeStyle = '#' + palette[m2gc].toString(16).padStart(6, "0");
        ctx.lineWidth = 1 * size / 36;
        for( let i=0; i<100; ++i )
            ctx.strokeRect( -size/1.3|0, size/2.7|0, size*1.5|0, size/1.4|0 );
        
        let img = document.createElement("img");
        img.src = canvas.toDataURL();
        return img;
    },

    makeTitle( text ){
        let size = 100;
        let canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = 24;

        let ctx = canvas.getContext("2d");
        let seed = 0;
        for( let i=0; i<text.length; ++i )
            seed += (seed >>> 15) ^ text.charCodeAt(i)*2987432;

        let bgc = (seed & 0x3) + 3;
        let fgc = ((seed+3) & 0x3) + 3;

        ctx.fillStyle = '#' + palette[bgc].toString(16).padStart(6, "0");
        ctx.fillRect( 0, 0, size, 24 );

        ctx.fillStyle = '#' + palette[fgc].toString(16).padStart(6, "0");
        ctx.strokeStyle = ctx.fillStyle;

        ctx.fillText(0, 0, text, size);
        return canvas;
    },

    MIME:{
        "png":"image/png",
        "bin":"application/bin"
    },

    importFile( name, file ){
        
        if( file.result )
            file = file.result;

        let ext = name.replace(/.*?\.([^.]+)$/, '$1').toLowerCase();

        let mime = APP.MIME[ ext ];
        if( !mime )
            return;
        
        switch( ext ){
        case 'png': // icon/screenshot
            let url = URL.createObjectURL(
                new Blob([file], {type:mime})
            );
            APP.importImage( url );
            break;

        case 'bin':
            APP.importBin( file, name );
            break;
        }            
    },

    makeThumbs(){
        if( !DATA.generatedThumbs )
            return;
        store("thumb24", APP.makeThumb( 24, name ));
        store("thumb36", APP.makeThumb( 36, name ));
        store("title100x24", APP.makeTitle( name ));
    },

    onChangeTitle( name ){
        name = name || DATA.title;
        APP.makeThumbs();
    },

    convert( type, img, w, h, key ){
        
        let arr = APP.img4bpp(
            type,
            img,
            w, h
        );

        store(key, APP.makePreview( arr ));

        img.onload = APP.convert.bind( APP, type, img, w, h, key );

    },

    importBin( data, name ){

        store("bin", data);

        name = name.replace(/\.bin$/gi, "");
        store("fileName", name + ".pop" );
        store("title", name.replace(/[_.]/g, ' '));

        APP.onChangeTitle( DATA.title );
        
        DOM.emulator.contentWindow.focus();
        DOM.emulator.contentWindow.loadFile( new Uint8Array(data) );
        
    },

    importImage( url ){

        let img = document.createElement("img");
        img.src = url;
        img.onload = onLoad;
        img.onerror = discard;
        img.style.display = "none";
        document.body.appendChild(img);

        function discard(){
            img.remove();
            URL.revokeObjectURL( url );
        }

        function onLoad(){
            img.remove();

            let width = img.naturalWidth;
            let height = img.naturalHeight;

            if( width == 24 ){
                store("thumb24", img);
                DATA.generatedThumbs = false;
            }else if( width == 36 ){
                store("thumb36", img);
                DATA.generatedThumbs = false;
            }else if( width == 110 && height == 24 ){
                store("title110x24", img);
                DATA.generatedThumbs = false;
            }else if( width == 200 && height == 80 ){
                store("title200x80", img);
                DATA.generatedThumbs = false;
            }else if( width == 220 && height == 176 ){
                DATA.screenshot.push( img );
                APP.makeThumbs();
                render();
            }

        }
        
    }

};

importData({
    bin:null,

    thumb24(v){
        if( !v ) return v;
        
        APP.convert(
            TagType.IMG_24X24_4BPP,
            v,
            24, 24,
            "preview24"
        );

        return v;
    },
    
    thumb36(v){
        if( !v ) return null;

        APP.convert(
            TagType.IMG_36X36_4BPP,
            v,
            36, 36,
            "preview36"
        );
        
        return v;
    },
    
    preview24:null,
    preview36:null,
    screenshot:[],
    title100x24:null,
    title200x80:null,
    title:null,
    author:null,
    version:null,
    fileName:null,
    description:null,
    name:null,
    generatedThumbs:true
});
