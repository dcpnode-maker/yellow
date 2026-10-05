// Original spatial studies. Synthetic concepts only, not executable hotel operations.
export const signatureConcepts = [
  {id:'09',title:'Threshold',subtitle:'Ask. Understand. Step inside.',category:'CONCIERGE · SPATIAL COMMAND',layout:'portal',
    summary:'One request opens a focused workspace. Context arrives before the next decision.',
    checks:['Understand the guest request','Bring the right context forward','Present the next decision','Open the focused workspace'],
    create(T,k){
      const root=new T.Group();
      const stone=k.mat('#ded9cc',{roughness:.55}), dark=k.mat('#29413a',{roughness:.28}), bronze=k.mat('#a78651',{metalness:.8,roughness:.24}), cream=k.mat('#faf5e9',{roughness:.5});
      const glass=k.mat('#c8e0d6',{transmission:.8,thickness:.3,roughness:.1,ior:1.42,transparent:true,opacity:.9});
      const mesh=(g,m,x=0,y=0,z=0)=>{const o=new T.Mesh(g,m);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;root.add(o);return o;};
      const box=(w,h,d,r,m,x,y,z)=>{const o=k.roundedBox(w,h,d,r,m);o.position.set(x,y,z);root.add(o);return o;};
      mesh(new T.CylinderGeometry(3.55,3.68,.26,96),stone,0,.05,0);
      mesh(new T.CylinderGeometry(3.36,3.4,.07,96),cream,0,.22,0);
      // Architectural arch is a true extruded open profile with a curved inner aperture.
      function arch(width,height,thickness,depth,material){
        const r=width/2,s=new T.Shape();s.moveTo(-r,0);s.lineTo(-r,height-r);s.absarc(0,height-r,r,Math.PI,0,true);s.lineTo(r,0);s.closePath();
        const ir=r-thickness, hole=new T.Path();hole.moveTo(-ir,.08);hole.lineTo(ir,.08);hole.lineTo(ir,height-r);hole.absarc(0,height-r,ir,0,Math.PI,false);hole.lineTo(-ir,.08);s.holes.push(hole);
        const g=new T.ExtrudeGeometry(s,{depth,bevelEnabled:true,bevelThickness:.055,bevelSize:.045,bevelSegments:4,steps:1,curveSegments:48});g.translate(0,0,-depth/2);
        const o=new T.Mesh(g,material);o.castShadow=o.receiveShadow=true;return o;
      }
      const gateway=new T.Group();root.add(gateway);gateway.position.set(0,.3,-.6);
      const frames=[];for(let i=0;i<7;i++){const a=arch(3.5-i*.105,4.2-i*.065,.17,.11,i%2?bronze:stone);a.position.z=-i*.18;gateway.add(a);frames.push(a);}
      const lintel=k.label('Y E L L O W',{size:.18,color:'#4d5849'});lintel.position.set(0,4.02,-.44);root.add(lintel);
      // Two sculpted doors separate and reveal the suite, rather than merely rotating a box.
      const doors=[];for(const side of [-1,1]){const door=new T.Group();door.position.set(side*.75,1.83,-.25);gateway.add(door);const panel=k.roundedBox(1.41,2.8,.11,.2,glass);door.add(panel);for(let j=0;j<14;j++){const rib=k.roundedBox(.024,2.53,.025,.01,bronze);rib.position.set(-.61+j*.094,0,.08);door.add(rib);}doors.push({door,side});}
      // Compact suite behind the gate, visible through the optical layers.
      box(2.65,.14,2.4,.09,dark,0,.45,-.55);box(2.4,.08,2.18,.04,cream,0,.57,-.52);
      box(1.72,.44,1.9,.13,stone,0,.82,-.72);box(1.74,.18,1.85,.15,cream,0,1.12,-.68);
      box(1.74,.07,.65,.04,k.mat('#708675'),0,1.24,-.05);
      for(const x of [-.45,.45]){box(.68,.2,.43,.14,k.mat('#fffbed'),x,1.3,-1.24);box(.33,.38,.4,.06,bronze,x*2.3,.8,-1.14);mesh(new T.SphereGeometry(.15,24,16),cream,x*2.3,1.22,-1.14);}
      // Approach: concentric inset paths, floating request glyph, and specimen trees.
      for(let i=0;i<4;i++){const step=box(1.85+i*.23,.09, .43,.05,i%2?stone:cream,0,.29-i*.027,1.0+i*.49);step.receiveShadow=true;}
      for(const x of [-2.52,2.52]){mesh(new T.CylinderGeometry(.39,.32,.6,48),stone,x,.55,.5);mesh(new T.CylinderGeometry(.035,.055,1.35,12),bronze,x,1.28,.5);for(let j=0;j<22;j++){const a=j*2.399,yy=1.75+(j%6)*.12,rr=.22+(j%4)*.05;const leaf=mesh(new T.SphereGeometry(1,12,8),k.mat(j%2?'#5f7562':'#87937a',{roughness:.8}),x+Math.cos(a)*rr,yy,.5+Math.sin(a)*rr);leaf.scale.set(.28,.12,.17);leaf.rotation.z=a;}}
      const token=new T.Group();root.add(token);const tokenBody=new T.Mesh(new T.IcosahedronGeometry(.23,2),bronze);token.add(tokenBody);const ring=new T.Mesh(new T.TorusGeometry(.4,.018,12,64),bronze);token.add(ring);
      const caption=k.label('ONE REQUEST · A CLEAR PATH',{size:.16,color:'#53604e'});caption.position.set(0,.58,2.73);root.add(caption);
      return {root,update(t){const u=.5-.5*Math.cos(t/7*Math.PI*2);doors.forEach(({door,side})=>{door.position.x=side*(.75+u*1.35);door.rotation.y=side*u*.25;});frames.forEach((f,i)=>{f.position.z=-i*.18-u*i*.045;});token.position.set(Math.sin(t*.9)*.14,1.1+Math.sin(t*.9)*.14,2.2-u*2.2);token.rotation.set(t*.3,t*.7,t*.2);root.rotation.y=-.12+Math.sin(t/7*Math.PI*2)*.09;},camera(t){return{position:[8.8+Math.sin(t*.32)*.6,5.9,10.8],target:[-.95,1.82,.1],fov:38};}};
    }},
  {id:'10',title:'Palm',subtitle:'The whole stay. In your hand.',category:'MOBILE · SPATIAL ROOM SELECTION',layout:'mobile',
    summary:'A native-sized task surface, with a room you can understand before you assign it.',
    checks:['Open the arrival brief','Explore the suggested suite','Review the room match','Confirm the next step'],
    create(T,k){
      const root=new T.Group();const aluminum=k.mat('#8f9890',{metalness:.85,roughness:.25}),ivory=k.mat('#f4f1e7',{roughness:.4}),ink=k.mat('#24392f',{roughness:.45}), sage=k.mat('#9fad91',{roughness:.8}),gold=k.mat('#b6a174',{metalness:.75,roughness:.2});
      const device=new T.Group();root.add(device);device.rotation.set(-.16,-.3,.08);device.position.set(.35,2.8,0);
      function addbox(g,w,h,d,r,m,x,y,z){const o=k.roundedBox(w,h,d,r,m);o.position.set(x,y,z);g.add(o);return o;}
      addbox(device,3.12,5.7,.22,.32,aluminum,0,0,0);addbox(device,2.99,5.55,.12,.31,ink,0,0,.12);addbox(device,2.83,5.38,.06,.29,ivory,0,0,.2);
      addbox(device,.7,.18,.045,.09,ink,0,2.5,.25);addbox(device,.085,.59,.13,.04,aluminum,-1.58,1.1,0);addbox(device,.085,.85,.13,.04,aluminum,1.58,.75,0);
      const planeText=(txt,size,col)=>{const sprite=k.label(txt,{size,color:col});return new T.Mesh(new T.PlaneGeometry(sprite.scale.x,sprite.scale.y),new T.MeshBasicMaterial({map:sprite.material.map,transparent:true,depthWrite:false,toneMapped:false}));};
      const text=(txt,x,y,size=.2,col='#273e31')=>{const o=planeText(txt,size,col);o.position.set(x,y,.32);device.add(o);return o;};
      text('9:41',-1.03,2.5,.13);text('•••',1.03,2.5,.13);text('ARRIVAL / 01',-.7,2.12,.15);text('Ananya Rao',-.47,1.72,.35);text('Deluxe King · 2 nights',-.51,1.39,.16,'#6b7566');
      const room=new T.Group();device.add(room);room.position.set(0,.15,1.15);room.rotation.set(.32,-.42,0);room.scale.setScalar(.75);
      addbox(room,3.25,.16,2.9,.06,k.mat('#d1b78f'),0,-.85,0);addbox(room,3.25,1.7,.09,.03,ivory,0,0,-1.42);addbox(room,.09,1.7,2.9,.03,ivory,-1.6,0,0);
      // Fine parquet, window mullions and upholstery stay readable in the mobile hero.
      for(let j=0;j<14;j++)addbox(room,.018,.012,2.75,.004,k.mat('#b9a384'),-1.49+j*.225,-.756,0);
      for(let j=0;j<7;j++)addbox(room,.1,1.55,.065,.02,j%2?sage:gold,-1.4+j*.16,.03,-1.34);
      addbox(room,1.65,.36,2.0,.1,k.mat('#b6b6a4'),.37,-.49,-.06);addbox(room,1.65,.2,2.0,.14,ivory,.37,-.21,-.06);addbox(room,1.67,.045,.69,.03,sage,.37,-.087,.55);
      for(const x of [-.06,.76]){addbox(room,.68,.18,.42,.14,k.mat('#fffcf0'),x,-.045,-.66);addbox(room,.42,.32,.44,.05,k.mat('#ad8f6b'),x<0?-.73:1.42,-.58,-.64);}
      const rug=new T.Mesh(new T.CircleGeometry(.61,48),sage);rug.rotation.x=-Math.PI/2;rug.position.set(-.89,-.743,.62);room.add(rug);
      const chair=new T.Group();room.add(chair);chair.position.set(-.9,-.5,.63);addbox(chair,.56,.2,.56,.13,ivory,0,0,0);addbox(chair,.57,.52,.15,.08,sage,0,.18,-.23);
      for(const x of [-.2,.2])for(const z of [-.2,.2]){const leg=new T.Mesh(new T.CylinderGeometry(.025,.025,.28,12),gold);leg.position.set(x,-.22,z);chair.add(leg);}
      addbox(device,2.37,.79,.055,.15,k.mat('#e5e8da'),0,-1.39,.28);text('202  /  Garden suite',-.12,-1.22,.2);text('Inspected · ready to arrive',-.13,-1.5,.14,'#65725b');
      addbox(device,2.37,.44,.055,.16,ink,0,-2.14,.28);text('Review room assignment  →',0,-2.13,.17,'#fbf8ea');addbox(device,.93,.045,.03,.02,ink,0,-2.55,.26);
      // Physical context chips move along depth, not a CSS card hover.
      const chips=[];for(let i=0;i<3;i++){const g=new T.Group();root.add(g);addbox(g,1.42,.52,.11,.13,i===1?ink:ivory,0,0,0);const txt=planeText(['Quiet location','Guest preference','Ready now'][i],.12,i===1?'#f4eed9':'#3c5340');txt.position.z=.09;g.add(txt);chips.push(g);}
      const pedestal=new T.Mesh(new T.CylinderGeometry(2.43,2.58,.2,96),k.mat('#e1dfd3',{roughness:.6}));pedestal.position.set(.35,0,0);pedestal.receiveShadow=true;root.add(pedestal);
      return{root,update(t){const u=.5-.5*Math.cos(t/7*Math.PI*2);device.rotation.y=-.24+u*.3;device.rotation.z=.025+Math.sin(t*.5)*.025;device.position.y=2.83+Math.sin(t*.9)*.045;room.position.z=1.0+u*.7;room.rotation.y=-.42+u*.5;chips.forEach((g,i)=>{const a=t*.27+i*2.05;g.position.set(.4+Math.cos(a)*2.3,1.8+i*.7,Math.sin(a)*1.35);g.rotation.y=.08*Math.sin(a);});},camera(t){return{position:[7.8,5.2,12.3],target:[-1.03,2.68,0],fov:36};}};
    }}
];
