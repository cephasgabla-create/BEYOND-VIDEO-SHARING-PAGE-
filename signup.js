(() => {
 const form=document.getElementById("signupForm"),message=document.getElementById("signupFormMessage"),button=document.getElementById("signupButton"),choiceMessage=document.getElementById("signupMessage"),modal=document.getElementById("signupEmailModal");
 const sayChoice=s=>{if(choiceMessage)choiceMessage.textContent=s};
 document.querySelectorAll("[data-method]").forEach(el=>el.addEventListener("click",async()=>{const method=el.dataset.method;if(method==="email"){modal.hidden=false;document.body.classList.add("modal-open");document.getElementById("username").focus();return}if(["google","facebook","apple"].includes(method)){try{if(!configured())throw new Error("Supabase setup is not finished yet.");const db=window.beyondDB||initBeyondDatabase();const {error}=await db.auth.signInWithOAuth({provider:method,options:{redirectTo:new URL("index.html",location.href).href}});if(error)throw error}catch(error){sayChoice(error?.message||"Social sign-up could not start. Check the provider settings in Supabase.")}return}sayChoice("QR sign-up is not available yet. Choose phone or email to create your account.");}));
 const closeModal=()=>{modal.hidden=true;document.body.classList.remove("modal-open");sayChoice("");};
 document.getElementById("closeSignupModal")?.addEventListener("click",closeModal);
 modal?.addEventListener("click",e=>{if(e.target===modal)closeModal()});
 document.addEventListener("keydown",e=>{if(e.key==="Escape"&&modal&&!modal.hidden)closeModal()});
 const configured=()=>typeof beyondDatabaseConfigured==="function"&&beyondDatabaseConfigured();
 function say(s){message.textContent=s}
 form.querySelectorAll("[data-toggle]").forEach(toggle=>toggle.addEventListener("click",()=>{const input=document.getElementById(toggle.dataset.toggle),visible=input.type==="password";input.type=visible?"text":"password";toggle.textContent=visible?"Hide":"Show";toggle.setAttribute("aria-pressed",String(visible))}));
 form.addEventListener("submit",async e=>{e.preventDefault();say("");const username=document.getElementById("username").value.trim().replace(/^@/,""),email=document.getElementById("email").value.trim().toLowerCase(),password=document.getElementById("password").value,confirm=document.getElementById("confirmPassword").value;
 if(!/^[A-Za-z0-9._-]{3,30}$/.test(username)){say("Choose a username with 3–30 letters, numbers, dots, underscores or hyphens.");return}
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){say("Enter a valid email address.");return}
 if(password.length<8){say("Your password must be at least 8 characters.");return}
 if(password!==confirm){say("Your passwords do not match.");document.getElementById("confirmPassword").focus();return}
 button.disabled=true;button.textContent="Creating account…";
 try{if(!configured())throw new Error("Supabase setup is not finished. Add your project URL and public anon/publishable key to supabase.js.");const db=window.beyondDB||initBeyondDatabase();if(!db)throw new Error("Beyond authentication could not start. Refresh and try again.");
 const {data,error}=await db.auth.signUp({email,password,options:{data:{username,display_name:username},emailRedirectTo:new URL("index.html",location.href).href}});if(error)throw error;if(!data.user)throw new Error("Supabase did not confirm account creation.");
 if(data.session){const {error:profileError}=await db.rpc("ensure_beyond_profile",{requested_username:username,requested_display_name:username});if(profileError)throw new Error(/duplicate|unique/i.test(profileError.message)?"That username is already taken.":profileError.message);location.replace("index.html");return}
 form.reset();closeModal();sayChoice("Your account has been created. Check your email and confirm your address before logging in.");button.disabled=false;button.textContent="Create account";
 }catch(error){console.error("Beyond signup:",error);const m=String(error?.message||"Could not create your account.");sayChoice("");say(/already registered|user already exists/i.test(m)?"That email may already be registered. Try logging in instead.":/duplicate|username.*taken|unique/i.test(m)?"That username is already taken. Please choose another.":m);button.disabled=false;button.textContent="Create account"}
 });
})();