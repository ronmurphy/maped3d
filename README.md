# maped3D
load a D&amp;D picture map, outline it, and see it in a primitive 3D

this is a work in progress, the 2D simple map outlining works, the 3D is not in yet.  Feel free to look and explore.

this is a kind of a fork of some earlier code that was wrote in a horrible lazy method, and i am splitting the code in to seperate, manageable class files.  never cut corners.

javascript bookmarklet version 2, downloads the webp token along with copying essential data, a slight time saver.  version 1 without the webp download is below.

``
javascript:(function(){const c=document.getElementById('wrp-pagecontent');if(!c){alert('Content div not found!');return}const t=c.outerHTML,n=c.querySelector('.stats__h-name')?.textContent||'Unknown',y=c.querySelector('i')?.textContent||'',a=c.querySelector('strong[title="Armor Class"]')?.nextSibling?.textContent||'',h=c.querySelector('strong[title="Hit Points"]')?.nextSibling?.textContent||'',i=c.querySelector('.stats__token')?.src||'';if(i){const f=n.toLowerCase().replace(/\s+/g,'_')+'.webp',l=document.createElement('a');l.href=i;l.download=f;document.body.appendChild(l);l.click();setTimeout(()=>document.body.removeChild(l),100)}const m=document.createElement('div');m.style.cssText='position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:white;padding:20px;border:2px solid #ccc;border-radius:5px;z-index:10000;max-width:400px;box-shadow:0%200%2010px%20rgba(0,0,0,0.5);';m.innerHTML=`<div%20style="display:flex;align-items:start;gap:10px;margin-bottom:10px;">${i?`<img%20src="${i}"style="width:100px;height:100px;object-fit:contain;">`:''}%20<div><h3%20style="margin:0;color:#822000;font-size:20px;">${n}</h3><p%20style="margin:5px%200;font-style:italic;">${y}</p><p%20style="margin:5px%200;">AC:${a.trim()}</p><p%20style="margin:5px%200;">HP:${h.trim()}</p></div></div><div%20style="text-align:center;"><p%20style="color:green;margin:5px%200;">%E2%9C%93%20Monster%20data%20copied%20to%20clipboard!</p>${i?'<p%20style="color:green;margin:5px%200;">%E2%9C%93%20Token%20image%20downloaded!</p>':''}<button%20onclick="this.parentElement.parentElement.remove()"style="padding:5px%2010px;margin-top:10px;cursor:pointer;">Close</button></div>`;document.body.appendChild(m);if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(t).catch(e=>{const%20x=document.createElement('textarea');x.value=t;document.body.appendChild(x);x.select();try{document.execCommand('copy')}catch(r){alert('Unable%20to%20copy:%20'+r.message)}finally{document.body.removeChild(x)}})}else{const%20x=document.createElement('textarea');x.value=t;document.body.appendChild(x);x.select();try{document.execCommand('copy')}catch(e){alert('Unable%20to%20copy:%20'+e.message)}finally{document.body.removeChild(x)}}})();
``


## Development Credits
Storyboard.js and the associated narrative engine were co-developed by Ron and Claude (Anthropic's AI assistant) through an extensive collaborative process spanning multiple sessions and iterations. This project demonstrates how human creativity and AI capabilities can combine to build complex, interactive systems.
