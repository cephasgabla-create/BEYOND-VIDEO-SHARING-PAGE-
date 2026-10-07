const form=document.getElementById("loginForm");const message=document.createElement("p");message.id="loginMessage";message.setAttribute("aria-live","polite");form.insertBefore(message,form.querySelector("button"));
form.addEventListener("submit",e=>{e.preventDefault();const email=document.getElementById("email").value.trim().toLowerCase(),password=document.getElementById("password").value,users=JSON.parse(localStorage.getItem("beyondUsers")||"[]"),user=users.find(u=>u.email===email&&u.password===password);if(!user){message.textContent="Email or password is incorrect.";return}localStorage.setItem("beyondUsername",user.username);localStorage.setItem("beyondEmail",user.email);localStorage.setItem("beyondLoggedIn","true");location.href="index.html")};
async function beyondDatabaseLogin(email,password){
 const db=window.beyondDB||initBeyondDatabase();
 if(!db)return false;
 const {data,error}=await db.auth.signInWithPassword({email,password});
 if(error)throw error;
 localStorage.setItem("beyondLoggedIn","true");
 localStorage.setItem("beyondEmail",email);
 localStorage.setItem("beyondUsername",data.user?.user_metadata?.username||email.split("@")[0]);
 return true;
}
