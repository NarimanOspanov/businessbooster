// Общий код раздела /ipoteka: форматирование, заявки, окна, кредитный рейтинг.
// Страницы подключают его и пользуются window.IP.
(function(){
  "use strict";
  var M = 1e6;
  var IP = window.IP = {};

  IP.num = function(v){ v = String(v==null?"":v).replace(/[^0-9]/g,""); return v ? Number(v) : 0; };
  IP.fmt = function(n){ return Math.round(n).toLocaleString("ru-RU"); };
  IP.mln = function(n){ var v = n/M; return (v>=10?Math.round(v):Math.round(v*10)/10).toLocaleString("ru-RU")+" млн ₸"; };
  IP.esc = function(s){ return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); };
  IP.plural = function(n, f){ n = Math.abs(n)%100; var n1 = n%10; if(n>10&&n<20) return f[2]; if(n1>1&&n1<5) return f[1]; if(n1===1) return f[0]; return f[2]; };
  IP.normPhone = function(v){ var d = String(v||"").replace(/[^0-9]/g,""); if(d.length===10) d="7"+d; if(d.length===11&&d[0]==="8") d="7"+d.slice(1); return /^7[0-9]{10}$/.test(d) ? d : null; };
  IP.post = function(url, body){
    return fetch(url, {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body)})
      .then(function(r){ return r.json().catch(function(){ return {ok:false, error:"сервер не ответил"}; }); });
  };
  IP.$ = function(s,r){ return (r||document).querySelector(s); };
  IP.$$ = function(s,r){ return Array.prototype.slice.call((r||document).querySelectorAll(s)); };

  // Денежные поля: разряды пробелами.
  document.addEventListener("input", function(e){
    if(e.target.classList && e.target.classList.contains("money")){ var n = IP.num(e.target.value); e.target.value = n ? IP.fmt(n) : ""; }
  });

  // Окна: открыть по id, закрыть по крестику, фону и Esc.
  IP.openModal = function(id){ IP.closeModals(); var m = document.getElementById(id); if(m){ m.classList.add("on"); document.body.style.overflow = "hidden"; } };
  IP.closeModals = function(){ IP.$$(".modal").forEach(function(m){ m.classList.remove("on"); }); document.body.style.overflow = ""; };
  document.addEventListener("click", function(e){
    var t = e.target;
    if(t.classList && t.classList.contains("modal")){ IP.closeModals(); return; }
    if(t.closest && t.closest("[data-close]")){ IP.closeModals(); return; }
    var o = t.closest && t.closest("[data-lead]");
    if(o){ e.preventDefault(); IP.openLead({ product: o.getAttribute("data-lead") || "consult" }); }
  });
  document.addEventListener("keydown", function(e){ if(e.key==="Escape") IP.closeModals(); });

  // Заявка. ctx: product (consult | apply | refusal | history), program, extra()
  // — страница может добавить анкету и подходящие программы.
  IP.leadForm = function(p){
    return "<div class='formgrid'><div><input class='inp' id='"+p+"Name' placeholder='Имя' autocomplete='given-name'></div><div><input class='inp' id='"+p+"Phone' type='tel' inputmode='tel' placeholder='+7 7__ ___ __ __' autocomplete='tel'></div></div>"+
      "<div class='q' style='margin:12px 0 0'><span class='t'>Как связаться</span><div class='opts'>"+
      "<label class='opt'><input type='radio' name='"+p+"Via' value='whatsapp' checked><span>WhatsApp</span></label>"+
      "<label class='opt'><input type='radio' name='"+p+"Via' value='telegram'><span>Telegram</span></label>"+
      "<label class='opt'><input type='radio' name='"+p+"Via' value='call'><span>Звонок</span></label></div></div>"+
      "<label class='consent'><input type='checkbox' id='"+p+"Ok'><span>Согласен на сбор и обработку персональных данных согласно Закону РК № 94-V.</span></label>"+
      "<button class='btn block lg' type='button' id='"+p+"Send'>Отправить заявку</button><div class='err' id='"+p+"Err'></div>";
  };
  IP.bindLead = function(p, box, ctx){
    ctx = ctx || {};
    document.getElementById(p+"Send").addEventListener("click", function(){
      var ph = IP.normPhone(document.getElementById(p+"Phone").value), e = document.getElementById(p+"Err"), b = this;
      if(!ph){ e.textContent = "Телефон: +7 и 10 цифр"; return; }
      if(!document.getElementById(p+"Ok").checked){ e.textContent = "Отметьте согласие на обработку данных"; return; }
      var via = (IP.$("input[name='"+p+"Via']:checked") || {}).value || "whatsapp";
      b.disabled = true; b.textContent = "Отправляем…"; e.textContent = "";
      var qs = new URLSearchParams(location.search);
      var body = { name: document.getElementById(p+"Name").value.trim(), phone: ph, via: via, consent: true,
        product: ctx.product || "consult", program: ctx.program ? ctx.program.id : null,
        programName: ctx.program ? ctx.program.bank+" · "+ctx.program.name : null, score: IP.score || null,
        src: qs.get("utm_source") || qs.get("src") || "", campaign: qs.get("utm_campaign") || "", ref: document.referrer || "",
        page: location.pathname };
      var extra = typeof IP.leadExtra === "function" ? IP.leadExtra() : {};
      for(var k in extra) body[k] = extra[k];
      IP.post("/api/ipoteka/lead", body).then(function(j){
        if(!j.ok) throw new Error(j.error || "не удалось отправить");
        box.innerHTML = "<div class='done'><div class='ic'>✓</div><h3 style='margin:0 0 6px;font-size:18px'>Заявка принята</h3><p style='margin:0;font-size:14px'>Свяжемся "+({whatsapp:"в WhatsApp",telegram:"в Telegram",call:"по телефону"}[via])+" в течение рабочего дня.</p></div>";
      }).catch(function(x){ b.disabled = false; b.textContent = "Отправить заявку"; e.textContent = "Ошибка: "+x.message; });
    });
  };
  var TITLES = { consult:"Бесплатная консультация", refusal:"Разберём причину отказа", history:"Разбор кредитной истории" };
  IP.openLead = function(ctx){
    ctx = ctx || {};
    var m = document.getElementById("m-lead");
    if(!m){
      m = document.createElement("div"); m.className = "modal"; m.id = "m-lead"; m.setAttribute("role","dialog"); m.setAttribute("aria-modal","true");
      m.innerHTML = "<div class='dlg'><button class='x' type='button' data-close aria-label='Закрыть'>×</button><div class='hd'><h3 id='ldT'></h3><p id='ldSub'></p></div><div class='bd' id='ldBody'></div></div>";
      document.body.appendChild(m);
    }
    var p = ctx.program;
    document.getElementById("ldT").textContent = p ? "Заявка: "+p.name : (TITLES[ctx.product] || TITLES.consult);
    document.getElementById("ldSub").textContent = p ? p.bank+". Проверим ваши условия и поможем подать заявку." : "Свяжемся в течение рабочего дня. Это бесплатно.";
    var body = document.getElementById("ldBody");
    body.innerHTML = IP.leadForm("m");
    IP.bindLead("m", body, ctx);
    IP.openModal("m-lead");
  };

  // Кредитный рейтинг: ИИН и телефон → код → рейтинг. Сервер пока отвечает
  // тестовыми данными (заглушка бюро в scripts/credit-bureau.js).
  IP.score = null;
  IP.mountCredit = function(box, opts){
    opts = opts || {};
    var st = {};
    function step1(){
      box.innerHTML =
        "<div class='two'><div class='q'><label class='lbl' for='cIin'>ИИН</label><input class='inp' id='cIin' inputmode='numeric' maxlength='12' placeholder='12 цифр' autocomplete='off'></div>"+
        "<div class='q'><label class='lbl' for='cPhone'>Телефон</label><input class='inp' id='cPhone' type='tel' inputmode='tel' placeholder='+7 7__ ___ __ __' autocomplete='tel'></div></div>"+
        "<label class='consent'><input type='checkbox' id='cOk'><span>Согласен на запрос моих данных в кредитное бюро и на обработку персональных данных по Закону РК № 94-V.</span></label>"+
        "<button class='btn lg' type='button' id='cGo'>Получить код</button><div class='err' id='cErr'></div>";
      document.getElementById("cGo").addEventListener("click", function(){
        var iin = String(document.getElementById("cIin").value).replace(/[^0-9]/g,""), ph = IP.normPhone(document.getElementById("cPhone").value), e = document.getElementById("cErr"), b = this;
        if(iin.length!==12){ e.textContent = "ИИН — 12 цифр"; return; }
        if(!ph){ e.textContent = "Телефон: +7 и 10 цифр"; return; }
        if(!document.getElementById("cOk").checked){ e.textContent = "Нужно согласие на запрос в кредитное бюро"; return; }
        b.disabled = true; b.textContent = "Отправляем…"; e.textContent = "";
        IP.post("/api/credit/start", {iin:iin, phone:ph, consent:true}).then(function(j){
          b.disabled = false; b.textContent = "Получить код";
          if(!j.ok){ e.textContent = j.error || "Не получилось"; return; }
          st.id = j.requestId; st.phone = ph; step2(j);
        }).catch(function(x){ b.disabled = false; b.textContent = "Получить код"; e.textContent = "Ошибка сети: "+x.message; });
      });
    }
    function step2(j){
      box.innerHTML = (j.stub ? "<div class='stubnote'>"+IP.esc(j.hint || "Тестовый режим")+". Подключение к кредитному бюро в работе.</div>" : "")+
        "<p style='font-size:14px;margin:0 0 12px'>Код отправлен на +"+st.phone+"</p>"+
        "<div class='q'><label class='lbl' for='cCode'>Код из SMS</label><input class='inp' id='cCode' inputmode='numeric' maxlength='6' autocomplete='one-time-code' style='max-width:200px;font-size:18px;letter-spacing:.2em'></div>"+
        "<div class='nav2' style='justify-content:flex-start'><button class='btn outline' type='button' id='cBack'>Назад</button><button class='btn' type='button' id='cConfirm'>Подтвердить</button></div><div class='err' id='cErr'></div>";
      document.getElementById("cBack").addEventListener("click", step1);
      document.getElementById("cConfirm").addEventListener("click", function(){
        var b = this, e = document.getElementById("cErr"); b.disabled = true;
        IP.post("/api/credit/confirm", {requestId:st.id, code:document.getElementById("cCode").value}).then(function(r){
          b.disabled = false;
          if(!r.ok){ e.textContent = r.error || "Не получилось"; return; }
          IP.score = r.score; step3(r); if(opts.onDone) opts.onDone(r);
        }).catch(function(x){ b.disabled = false; e.textContent = "Ошибка сети: "+x.message; });
      });
    }
    function step3(r){
      var pos = Math.max(0, Math.min(100, r.score/1200*100));
      box.innerHTML = (r.stub ? "<div class='stubnote'>Тестовые данные: кредитное бюро ещё не подключено.</div>" : "")+
        "<div class='score'><div class='n'>"+r.score+"</div><div class='of'>из 1200</div></div>"+
        "<div class='gauge'><i style='left:calc("+pos+"% - 2px)'></i></div><div class='gauge-l'>"+[0,400,600,800,1000,1200].map(function(v){ return "<span style='left:"+(v/1200*100)+"%'>"+v+"</span>"; }).join("")+"</div>"+
        "<p style='font-size:15px;margin:16px 0 6px'><b>"+IP.esc(r.bandText)+"</b></p>"+
        (r.loans!=null ? "<p style='font-size:13px;color:var(--mut);margin:0 0 16px'>Действующих кредитов: "+r.loans+(r.overdue?" · есть просрочка":"")+"</p>" : "")+
        (opts.after || "");
    }
    step1();
  };
})();
