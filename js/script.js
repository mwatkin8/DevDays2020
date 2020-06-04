let server = 'https://api.logicahealth.org/devdays2020/open';

async function getPatients(){
  let patients = [];
  let url = server + '/MedicationRequest';
  let next = true;
  while (next === true){
    next = false;
    let response = await fetch(url)
    let bundle = await response.json();
    bundle.entry.forEach((entry, i) => {
      let subject = entry.resource.subject.reference;
      if(patients.includes(subject) === false){
        patients.push(subject);
      }
      bundle.link.forEach((link, i) => {
        if(link.relation === 'next'){
          next = true;
          url = link.url;
        }
      });
    });
  }
  await buildSelect(patients)
  d3.select('.loading').classed('loading',false)
}

async function buildSelect(patients){
  let li = d3.select('#patient');
  let select = li.append('select').attr('id','select');
  patients.forEach((p, i) => {
    if(i === 0){
        select.append('option').attr('value', p).attr('selected','selected').text(p);
    }
    else{
      select.append('option').attr('value', p).text(p);
    }
  });
}

async function init(){
  getPatients()
  //demographics()
  //console.log(subjects);
}


async function demographics(){
    let response = await fetch(server + '/Patient?_id=' + patient);
    let bundle = await response.json();
    let p = bundle.entry[0].resource;
    let name = p.name[0].given[0] + ' ' + p.name[0].family + ' ';
    d3.select('#name').text(name);
    let today = new Date();
    let age = today.getFullYear() - parseInt(p.birthDate.split('-')[0]);
    let gender = p.gender
    d3.select('#dems').text(gender + ', ' + age + ' years old');
}

async function medCodes(){
    //Get MedicationRequest resources for patient and extract RxNorm codes
    let bundle = await getResource(server + '/MedicationRequest?subject=SMART-1288992');
    let meds = [];
    bundle.entry.forEach((entry, i) => {
      meds.push(entry.resource.medicationCodeableConcept.coding[0].code)
    });
    return meds;
}

async function buildTable(meds){
  let main = d3.select('#main');
    meds.forEach(async (code, i) => {
      let ref = 'https://davinci-drug-formulary-ri.logicahealth.org/fhir'
      let response = await fetch(ref + '/MedicationKnowledge?code=' + code)
      let bundle = await response.json();
      if (bundle.total !== 0){
        console.log(code);
        main.append('h3').text(bundle.entry[0].resource.code.coding[0].display);
        let div = main.append('div').attr('class','table-responsive med-table');
        let table = div.append('table').attr('class','table table-striped table-sm');
        let head = table.append('thead');
        let row = head.append('tr');
        row.append('th').text('FormularyDrug');
        row.append('th').text('DrugTierID');
        row.append('th').text('PriorAuthorization');
        row.append('th').text('StepTherapyLimit');
        row.append('th').text('QuantityLimit');
        row.append('th').text('PlanID');
        let body = table.append('tbody');
        //Loop through formularies for this medication
        let planIDs = [];
        bundle.entry.forEach((entry, i) => {
          row = body.append('tr');
          row.append('td').text(entry.fullUrl);
          entry.resource.extension.forEach((ext, i) => {
            if(i === 0){
              row.append('td').text(ext.valueCodeableConcept.coding[0].display);
            }
            else if (i === 4) {
                planIDs.push(ext.valueString);
                row.append('td').text(ext.valueString);
            }
            else{
              row.append('td').text(ext.valueBoolean);
            }
          });
        });
        //Pull the CoveragePlan for each PlanID
        table = div.append('table').attr('class','table table-striped table-sm');
        head = table.append('thead');
        row = head.append('tr');
        row.append('th').text('CoveragePlan');
        row.append('th').text('DrugTierID');
        row.append('th').text('MailOrder');
        row.append('th').text('CostSharing1');
        row.append('th').text('CostSharing2');
        row.append('th').text('CostSharing3');
        row.append('th').text('CostSharing4');
        body = table.append('tbody');
        planIDs.forEach(async (id, i) => {
          let response = await fetch(ref + '/List?identifier=' + id)
          let bundle = await response.json();
          row = body.append('tr');
          row.append('td').text(id);
          bundle.entry[0].resource.extension.forEach((ext, i) => {
            if(i === 0){
              row.append('td').text(ext.valueCodeableConcept.coding[0].display);
            }
            else if (i === 1) {
                row.append('td').text(ext.valueBoolean);
            }
            else{
              row.append('td').text(JSON.stringify(ext));
            }
          });


        });


      }
    });
}



/*
<h2>Section title</h2>
<div class="table-responsive">
  <table class="table table-striped table-sm">
    <thead>
      <tr>
        <th>#</th>
        <th>Header</th>
        <th>Header</th>
        <th>Header</th>
        <th>Header</th>
      </tr>
    </thead>
    <tbody>
    <tr>
      <td>1,001</td>
      <td>Lorem</td>
      <td>ipsum</td>
      <td>dolor</td>
      <td>sit</td>
    </tr>
    </tbody>
  </table>
</div>





*/
