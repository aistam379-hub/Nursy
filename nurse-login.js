// ================== DocBook Nurse — Login ==================

  (function() {
    var PASS = "nurse123";
    var overlay = document.getElementById("loginOverlay");
    var errBox  = document.getElementById("ln-error");
    var eyeBtn  = document.getElementById("ln-eye-toggle");
    var passInp = document.getElementById("ln-password");
    var submitBtn = document.getElementById("ln-submit");
    if (localStorage.getItem("docbook_nurse_auth") === "1") { overlay.classList.add("hidden"); }
    eyeBtn.addEventListener("click", function() {
      var isText = passInp.type === "text";
      passInp.type = isText ? "password" : "text";
      eyeBtn.classList.toggle("show-pass", !isText);
    });
    document.querySelectorAll(".ln-input-wrap input").forEach(function(inp) {
      inp.addEventListener("focus", function() { var f=inp.closest(".ln-field"); if(f){var l=f.querySelector(".ln-label");if(l)l.style.color="#2dd4bf";} });
      inp.addEventListener("blur",  function() { var f=inp.closest(".ln-field"); if(f){var l=f.querySelector(".ln-label");if(l)l.style.color="";} });
    });
    function showErr(m){errBox.textContent=m;errBox.classList.add("show");}
    function doLogin(){
      var p=passInp.value;
      if(!p){showErr("يرجى إدخال كلمة المرور");return;}
      if(p!==PASS){showErr("كلمة المرور غير صحيحة، حاول مجدداً");passInp.value="";passInp.focus();return;}
      errBox.classList.remove("show");
      localStorage.setItem("docbook_nurse_auth","1");
      overlay.style.transition="opacity 0.5s ease";
      overlay.style.opacity="0";
      setTimeout(function(){overlay.classList.add("hidden");},500);
    }
    submitBtn.addEventListener("click", function(e) {
      var rect=submitBtn.getBoundingClientRect();
      var ripple=document.createElement("span");
      var size=Math.max(rect.width,rect.height);
      ripple.classList.add("ln-ripple");
      ripple.style.cssText="width:"+size+"px;height:"+size+"px;left:"+(e.clientX-rect.left-size/2)+"px;top:"+(e.clientY-rect.top-size/2)+"px;";
      submitBtn.appendChild(ripple);
      ripple.addEventListener("animationend",function(){ripple.remove();});
      doLogin();
    });
    passInp.addEventListener("keydown",function(e){if(e.key==="Enter")doLogin();});
    document.getElementById("ln-email").addEventListener("keydown",function(e){if(e.key==="Enter")passInp.focus();});
  })();