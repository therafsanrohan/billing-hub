require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY; // Service role key to bypass RLS

const supabase = createClient(supabaseUrl, supabaseKey);

async function fix() {
  // Get all users
  const { data: users, error: usersError } = await supabase.auth.admin.listUsers();
  if (usersError) throw usersError;

  for (const user of users.users) {
    // Check if user is in a business
    const { data: member, error: memberError } = await supabase
      .from('business_members')
      .select('business_id')
      .eq('user_id', user.id)
      .single();

    if (!member) {
      console.log(`Creating business for user ${user.id}`);
      
      // Create business
      const { data: business, error: bizError } = await supabase
        .from('businesses')
        .insert({ name: 'My Business' })
        .select()
        .single();
        
      if (bizError) throw bizError;
      
      // Add member
      const { error: joinError } = await supabase
        .from('business_members')
        .insert({
          business_id: business.id,
          user_id: user.id,
          role: 'OWNER'
        });
        
      if (joinError) throw joinError;
      
      // Create location
      await supabase
        .from('inventory_locations')
        .insert({
          business_id: business.id,
          name: 'Main Store',
          is_default: true
        });
        
      console.log(`Successfully created business for ${user.id}`);
    } else {
      console.log(`User ${user.id} already has a business.`);
    }
  }
}

fix().catch(console.error);
