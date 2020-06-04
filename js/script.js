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
  let select = li.append('select').attr('id','select').attr('onchange','changeSelection()');
  patients.forEach((p, i) => {
    if(i === 0){
        select.append('option').attr('value', p).attr('selected','selected').text(p);
    }
    else{
      select.append('option').attr('value', p).text(p);
    }
  });
}

async function changeSelection(){
  d3.selectAll('.med-container').remove();
  let selected = d3.select("#select").node().value;
  demographics(selected);
  let meds = await getMeds(selected);
  buildTable(meds);
}

async function init(){
  await getPatients()
  let selected = d3.select("#select").node().value;
  demographics(selected);
  let meds = await getMeds(selected);
  buildTable(meds);
}

async function demographics(selected){
    let url = server + '/' + selected;
    let response = await fetch(url);
    let p = await response.json();
    let name = p.name[0].given[0] + ' ' + p.name[0].family + ' ';
    d3.select('#name').text(name);
    let today = new Date();
    let age = today.getFullYear() - parseInt(p.birthDate.split('-')[0]);
    let gender = p.gender
    d3.select('#dems').text(gender + ', ' + age + ' years old');
}

async function getMeds(selected){
    //Get MedicationRequest resources for patient and extract RxNorm codes
    let id = selected.split('/')[1];
    let response = await fetch(server + '/MedicationRequest?subject=' + id);
    let bundle = await response.json();
    let meds = [];
    bundle.entry.forEach((entry, i) => {
      let code = entry.resource.medicationCodeableConcept.coding[0].code;
      let display = entry.resource.medicationCodeableConcept.coding[0].display;
      meds.push([code,display]);
    });
    return meds;
}

async function buildTable(meds){
  let ref = 'https://davinci-drug-formulary-ri.logicahealth.org/fhir';
  let main = d3.select('#main');
    meds.forEach(async (m, i) => {
      let code = m[0];
      let display = m[1];
      let container = main.append('div').attr('class','med-container');
      container.append('h3').text(display);
      //Query formularies for the medication
      let response = await fetch(ref + '/MedicationKnowledge?code=' + code);
      let bundle = await response.json();
      if (bundle.total !== 0){
        //If any exist, create a table to display the data
        let div = container.append('div').attr('class','table-responsive med-table');
        let table = div.append('table').attr('class','table table-striped table-sm');
        //Set headers for the table
        let head = table.append('thead');
        let row = head.append('tr');
        row.append('th').text('FormularyDrug');
        row.append('th').text('DrugTierID');
        row.append('th').text('PriorAuthorization');
        row.append('th').text('StepTherapyLimit');
        row.append('th').text('QuantityLimit');
        row.append('th').text('PlanID');
        //Create the table body
        let body = table.append('tbody');
        let planIDs = []; //Keep a collection of CoveragePlan IDs for a separate table
        bundle.entry.forEach((entry, i) => {
          //Create table rows for the related formularities
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
        planIDs.forEach(async (id, i) => {
          let response = await fetch(ref + '/List?identifier=' + id)
          let bundle = await response.json();
          div.append('h5').style('font-style','italic').html(
            'CoveragePlan: ' + bundle.entry[0].resource.title
          );
          div.append('p').html(
            'PlanID: ' + id +
            '<br>PlanIDType: ' + bundle.entry[0].resource.extension[9].valueString+
            '<br>Network: ' + bundle.entry[0].resource.extension[6].valueString + 
            '<br>SummaryURL: ' + bundle.entry[0].resource.extension[7].valueString +
            '<br>EmailPlanContact: ' + bundle.entry[0].resource.extension[8].valueString
          )
          //Create another table for the Coverage Plans referenced in the above formularies
          table = div.append('table').attr('class','table table-striped table-sm');
          //Set headers for the table
          head = table.append('thead');
          row = head.append('tr');
          row.append('th').text('DrugTierID');
          row.append('th').text('MailOrder');
          row.append('th').text('CostSharing1');
          row.append('th').text('CostSharing2');
          row.append('th').text('CostSharing3');
          row.append('th').text('CostSharing4');
          //Table body
          body = table.append('tbody');    
          //10 fields      
          bundle.entry[0].resource.extension.forEach((ext,i) => {
            row = body.append('tr');
            if(i < 6){
              ext.extension.forEach((e,i) => {
              if(i === 0){
                row.append('td').text(e.valueCodeableConcept.coding[0].display);
              }
              else if (i === 1) {
                  row.append('td').text(e.valueBoolean);
              }
              else{
                let summary = '';
                e.extension.forEach((costsharing, i) => {
                  if(i === 0){
                    summary += costsharing.url + ": " + costsharing.valueCodeableConcept.coding[0].display + '<br>';
                  }
                  if(i === 1){
                    summary += costsharing.url + ": $" + costsharing.valueMoney.value + '<br>';
                  }
                  if(i === 2){
                    summary += costsharing.url + ": $" + costsharing.valueDecimal + '<br>';
                  }
                  if(i === 3){
                    summary += costsharing.url + ": " + costsharing.valueCodeableConcept.coding[0].display + '<br>';
                  }
                  if(i === 4){
                    summary += costsharing.url + ": " + costsharing.valueCodeableConcept.coding[0].display + '<br>';
                  }
                })
                row.append('td').html(summary);
              }
              });
            }
          });
        });


      }
      else{
        container.append('h6').text('No formularies for this medication.');
      }
      
    });
}