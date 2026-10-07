const form=document.getElementById("signupForm");const message=document.getElementById("signupMessage");
form.addEventListener("submit",e=>{e.preventDefault();const username=document.getElementById("username").value.trim().replace(/^@/,""),email=document.getElementById("email").value.trim().toLowerCase(),password=document.getElementById("password").value,confirmPassword=document.getElementById("confirmPassword").value;if(username.length<3){message.textContent="Username must be at least 3 characters.";return}if(password!==confirmPassword){message.textContent="Passwords do not match.";return}const users=JSON.parse(localStorage.getItem("beyondUsers")||"[]");if(users.some(u=>u.username.toLowerCase()===username.toLowerCase())){message.textContent="That username is already taken.";return}if(users.some(u=>u.email===email)){message.textContent="An account with that email already exists.";return}users.push({username,email,password});localStorage.setItem("beyondUsers",JSON.stringify(users));localStorage.setItem("beyondUsername",username);localStorage.setItem("beyondEmail",email);localStorage.setItem("beyondLoggedIn","true");location.href="index.html"});
async function beyondDatabaseSignup(username,email,password){
 const db=window.beyondDB||initBeyondDatabase();
 if(!db)return false;
 const {data,error}=await db.auth.signUp({email,password,options:{data:{username}}});
 if(error)throw error;
 if(data.user){
   await db.from("profiles").upsert({id:data.user.id,username,display_name:username});
 }
 localStorage.setItem("beyondUsername",username);
 localStorage.setItem("beyondEmail",email);
 return true;
}
